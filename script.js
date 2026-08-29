const REPO="Bixilon/Minosoft";

const GH_API=`https://api.github.com/repos/${REPO}`;
const GH="https://github.com/Bixilon/Minosoft";

const WORKFLOW_URL=
`${GH_API}/actions/workflows/build.yml/runs`;

const ARTIFACT_URL=
`${GH_API}/actions/runs`;

const RELEASE_URL=
`${GH_API}/releases`;

const COOKIE_NAME="minosoft_github_key";

const OS=[
["ubuntu","Linux"],
["windows","Windows"],
["macos","macOS"]
];

const ARCH=[
"amd64",
"aarch64"
];

let githubKey="";

function esc(v){
return String(v??"")
.replaceAll("&","&amp;")
.replaceAll("<","&lt;")
.replaceAll(">","&gt;")
.replaceAll('"',"&quot;")
.replaceAll("'","&#039;");
}

function utc(v){
return new Date(v).toLocaleString("en-GB",{
timeZone:"UTC",
year:"numeric",
month:"2-digit",
day:"2-digit",
hour:"2-digit",
minute:"2-digit",
hour12:false
})+" UTC";
}

function errorHTML(e){

const status=e.status??"Unknown";
const url=e.url??"Unknown";
const body=e.body??"";
const message=e.message??String(e);

return `
<div class="error">
⚠️ Failed to load versions.

<details>
<summary>Show error details</summary>

<pre>Message:
${esc(message)}

HTTP status:
${esc(status)}

URL:
${esc(url)}

Response:
${esc(body)}</pre>
</details>

<div class="error-help">
Use <b>Developer Options</b> below to insert a GitHub API key
and reload with authenticated requests if the unauthenticated
rate limit has been reached.
</div>

</div>
`;
}

async function get(url){

const headers={
"Accept":"application/vnd.github+json"
};

if(githubKey){
headers["Authorization"]=`Bearer ${githubKey}`;
}

const response=await fetch(url,{headers});
const body=await response.text();

if(!response.ok){

const e=new Error(
`HTTP ${response.status} ${response.statusText}`
);

e.status=response.status;
e.url=url;
e.body=body;

throw e;
}

try{
return JSON.parse(body);
}catch{

const e=new Error("Response was not valid JSON");

e.status=response.status;
e.url=url;
e.body=body;

throw e;
}
}

async function getAllReleases(){

const releases=[];
let page=1;

while(true){

const data=await get(
`${RELEASE_URL}?per_page=100&page=${page}`
);

if(!Array.isArray(data)||!data.length){
break;
}

releases.push(...data);

if(data.length<100){
break;
}

page++;
}

return releases;
}

function releaseIsPrerelease(release){
return release.prerelease===true;
}

function releaseAsset(release,os,arch){

const assets=release.assets||[];

return assets.find(asset=>{

const name=(asset.name||"").toLowerCase();

return name.includes(os)&&name.includes(arch);

});
}

function renderRelease(release){

let systems="";

for(const [key,name] of OS){

let buttons="";

for(const arch of ARCH){

const asset=releaseAsset(
release,
key,
arch
);

if(!asset){
continue;
}

buttons+=`
<a
class="download"
href="${esc(
asset.browser_download_url||
asset.url
)}"
target="_blank"
rel="noopener"
>
${esc(arch)}
<span class="asset-name">
${esc(asset.name)}
</span>
</a>
`;
}

if(!buttons){
continue;
}

systems+=`
<div class="os">
<div class="os-title">${esc(name)}</div>
<div class="buttons">${buttons}</div>
</div>
`;
}

if(!systems){

systems=`
<div class="empty">
No matching platform downloads found.
</div>
`;
}

const name=
release.name||
release.tag_name||
"Release";

const tag=
release.tag_name||"";

const date=
release.published_at||
release.created_at;

return `
<details class="version">

<summary>

<div class="version-info">

<div class="version-title">
<span>${esc(name)}</span>

${releaseIsPrerelease(release)?`
<span class="prerelease">
Pre-release
</span>
`:""}

</div>

<div class="version-message">
${esc(tag)}
</div>

</div>

<div class="date">
${date?esc(utc(date)):""}
</div>

<div class="arrow">▼</div>

</summary>

<div class="downloads">

${systems}

<a
class="release-link"
href="${esc(release.html_url||GH)}"
target="_blank"
rel="noopener"
>
View release on GitHub →
</a>

</div>

</details>
`;
}

async function loadReleases(){

const box=document.getElementById("releases");

try{

const releases=await getAllReleases();

document.getElementById(
"release-count"
).textContent=`(${releases.length})`;

if(!releases.length){

box.innerHTML=`
<div class="empty">
No releases have been published yet.
</div>
`;

return;
}

box.innerHTML=
releases.map(renderRelease).join("");

}catch(e){

box.innerHTML=errorHTML(e);
}
}

async function getAllSuccessfulRuns(){

const runs=[];
let page=1;

while(true){

const url=
WORKFLOW_URL+
`?branch=master`+
`&event=push`+
`&status=success`+
`&per_page=100`+
`&page=${page}`;

const data=await get(url);

if(
!data.workflow_runs||
data.workflow_runs.length===0
){
break;
}

for(const run of data.workflow_runs){

if(
run.event==="push"&&
run.head_branch==="master"&&
run.status==="completed"&&
run.conclusion==="success"
){
runs.push(run);
}
}

if(data.workflow_runs.length<100){
break;
}

page++;
}

runs.sort(
(a,b)=>
new Date(b.created_at)-
new Date(a.created_at)
);

return runs;
}

async function getArtifacts(runId){

const data=await get(
`${ARTIFACT_URL}/${runId}/artifacts?per_page=100`
);

return data.artifacts||[];
}

function makeArtifactMap(artifacts){

const result={};

for(const artifact of artifacts){

if(artifact.expired){
continue;
}

const match=artifact.name.match(
/^minosoft-(ubuntu|windows|macos)-(amd64|aarch64)$/
);

if(!match){
continue;
}

result[
`${match[1]}:${match[2]}`
]=artifact;
}

return result;
}

function renderSnapshot(run,artifacts){

const map=makeArtifactMap(artifacts);

let operatingSystems="";

for(const os of OS){

let buttons="";

for(const arch of ARCH){

const artifact=
map[`${os[0]}:${arch}`];

if(!artifact){
continue;
}

const url=
`${GH}/actions/runs/`+
`${run.id}/artifacts/`+
`${artifact.id}`;

buttons+=`
<a
class="download"
href="${esc(url)}"
target="_blank"
rel="noopener"
>
${esc(arch)}
</a>
`;
}

if(!buttons){
continue;
}

operatingSystems+=`
<div class="os">

<div class="os-title">
${esc(os[1])}
</div>

<div class="buttons">
${buttons}
</div>

</div>
`;
}

if(!operatingSystems){
return "";
}

return `
<details class="version">

<summary>

<div class="version-info">

<div class="version-title">
Minosoft

<span class="version-id">
${esc(
run.head_sha?
run.head_sha.substring(0,8):
"unknown"
)}
</span>

</div>

<div class="version-message">
${esc(
run.head_commit?.message
?.split("\n")[0]
?.trim()||
run.display_title||
"Snapshot"
)}
</div>

</div>

<div class="date">
${esc(utc(run.created_at))}
</div>

<div class="arrow">▼</div>

</summary>

<div class="downloads">

${operatingSystems}

<a
class="release-link"
href="${esc(run.html_url)}"
target="_blank"
rel="noopener"
>
View workflow run on GitHub →
</a>

</div>

</details>
`;
}

async function loadSnapshots(){

const box=document.getElementById("snapshots");

try{

const runs=await getAllSuccessfulRuns();

const snapshots=await Promise.all(
runs.map(async run=>{

try{

return{
run,
artifacts:await getArtifacts(run.id)
};

}catch(e){

console.warn(
"Could not load artifacts for run",
run.id,
e
);

return{
run,
artifacts:[]
};
}

})
);

let html="";
let count=0;

for(const snapshot of snapshots){

const rendered=renderSnapshot(
snapshot.run,
snapshot.artifacts
);

if(!rendered){
continue;
}

html+=rendered;
count++;
}

if(!html){

box.innerHTML=`
<div class="empty">
No downloadable snapshots found.
</div>
`;

}else{

box.innerHTML=html;
}

document.getElementById(
"snapshot-count"
).textContent=`(${count})`;

}catch(e){

box.innerHTML=errorHTML(e);
}
}

async function load(){

document.getElementById("status").textContent=
githubKey?
"Fetching versions with GitHub authentication…":
"Fetching versions…";

document.getElementById("releases").innerHTML=`
<div class="loading">
<img class="throbber" src="throbber.gif" alt="">
Loading releases…
</div>
`;

document.getElementById("snapshots").innerHTML=`
<div class="loading">
<img class="throbber" src="throbber.gif" alt="">
Loading snapshots…
</div>
`;

await Promise.allSettled([
loadReleases(),
loadSnapshots()
]);

const r=
document.getElementById("release-count")
.textContent||
"(0)";

const s=
document.getElementById("snapshot-count")
.textContent||
"(0)";

document.getElementById("status").textContent=
`${r.slice(1,-1)} releases · ${s.slice(1,-1)} snapshots`;
}

function setGitHubKey(key){
githubKey=String(key||"").trim();
}

function getCookieKey(){

const prefix=COOKIE_NAME+"=";

for(const part of document.cookie.split(";")){

const item=part.trim();

if(!item.startsWith(prefix)){
continue;
}

try{
return decodeURIComponent(
item.substring(prefix.length)
);
}catch{
return "";
}
}

return "";
}

function storeCookieKey(key){

if(!key){
return;
}

document.cookie=
`${COOKIE_NAME}=`+
`${encodeURIComponent(key)}`+
`; max-age=${60*60*24*365}`+
`; path=/; SameSite=Lax`;
}

function resetCookie(){

document.cookie=
`${COOKIE_NAME}=; max-age=0; path=/; SameSite=Lax`;
}

const keyInput=
document.getElementById("github-key");

const devStatus=
document.getElementById("dev-status");

document.getElementById(
"reload-key"
).addEventListener(
"click",
()=>{

const key=keyInput.value.trim();

if(!key){

devStatus.textContent=
"Enter a GitHub API key first.";

return;
}

setGitHubKey(key);

devStatus.textContent=
"Reloading with the entered GitHub API key…";

load();
}
);

document.getElementById(
"store-key"
).addEventListener(
"click",
()=>{

const key=keyInput.value.trim();

if(!key){

devStatus.textContent=
"Enter a GitHub API key first.";

return;
}

storeCookieKey(key);

devStatus.textContent=
"GitHub API key stored in this browser.";

}
);

document.getElementById(
"reload-cookie"
).addEventListener(
"click",
()=>{

const key=getCookieKey();

if(!key){

devStatus.textContent=
"No stored GitHub API key was found.";

return;
}

setGitHubKey(key);

keyInput.value=key;

devStatus.textContent=
"Reloading with the stored GitHub API key…";

load();

}
);

document.getElementById(
"reset-cookie"
).addEventListener(
"click",
()=>{

resetCookie();

setGitHubKey("");

keyInput.value="";

devStatus.textContent=
"Stored GitHub API key removed.";

}
);

const showKey=
document.getElementById("show-key");

showKey.addEventListener(
"mousedown",
()=>{
keyInput.type="text";
}
);

showKey.addEventListener(
"mouseup",
()=>{
keyInput.type="password";
}
);

showKey.addEventListener(
"mouseleave",
()=>{
keyInput.type="password";
}
);

showKey.addEventListener(
"touchstart",
e=>{
e.preventDefault();
keyInput.type="text";
}
);

showKey.addEventListener(
"touchend",
e=>{
e.preventDefault();
keyInput.type="password";
}
);

showKey.addEventListener(
"touchcancel",
()=>{
keyInput.type="password";
}
);

document.getElementById(
"refresh"
).addEventListener(
"click",
()=>{

setGitHubKey("");

keyInput.value="";

load();

}
);

load();
