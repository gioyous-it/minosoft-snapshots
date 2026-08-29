const REPO="Bixilon/Minosoft";
const BRANCH="master";
const WORKFLOW="build.yml";
const EVENT="push";
const STATUS="success";
const PER_PAGE=100;
const ARTIFACT_PREFIX="minosoft";
const COOKIE_NAME="minosoft_github_key";
const THROBBER="throbber.gif";

const OS=[
["ubuntu","Linux"],
["windows","Windows"],
["dummytest1","Dummy"],
["macos","macOS"]
];

const ARCHS=[
"amd64",
"dummytest2",
"aarch64"
];

const GH_API=`https://api.github.com/repos/${REPO}`;
const GH=`https://github.com/${REPO}`;
const WORKFLOW_URL=`${GH_API}/actions/workflows/${WORKFLOW}/runs`;
const RUNS_URL=`${GH_API}/actions/runs`;
const RELEASE_URL=`${GH_API}/releases`;

let githubKey="";

const esc=v=>String(v??"")
.replaceAll("&","&amp;")
.replaceAll("<","&lt;")
.replaceAll(">","&gt;")
.replaceAll('"',"&quot;")
.replaceAll("'","&#039;");

const loadingHTML=text=>`
<div class="loading">
<img class="throbber" src="${THROBBER}" alt="">
${text}
</div>
`;

const linkHTML=(url,text,extra="")=>`
<a
class="download"
href="${esc(url)}"
target="_blank"
rel="noopener"
>
${esc(text)}
${extra}
</a>
`;

const escapeRegex=v=>
String(v).replace(/[.*+?^${}()|[\]\\]/g,"\\$&");

const OS_PATTERN=OS.map(x=>escapeRegex(x[0])).join("|");
const ARCH_PATTERN=ARCHS.map(escapeRegex).join("|");

const ARTIFACT_PATTERN=new RegExp(
`^${escapeRegex(ARTIFACT_PREFIX)}-(${OS_PATTERN})-(${ARCH_PATTERN})$`
);

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

if(githubKey)
headers["Authorization"]=`Bearer ${githubKey}`;

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

async function getAll(url,key){
const out=[];
let page=1;

while(true){

const separator=url.includes("?")?"&":"?";

const data=await get(
`${url}${separator}per_page=${PER_PAGE}&page=${page}`
);

const items=key?data[key]:data;

if(!Array.isArray(items)||!items.length)
break;

out.push(...items);

if(items.length<PER_PAGE)
break;

page++;
}

return out;
}

function releaseAsset(release,os,arch){
return(release.assets||[]).find(asset=>{
const name=(asset.name||"").toLowerCase();

return name.includes(os)&&name.includes(arch);
});
}

function renderRelease(release){

let systems="";

for(const [os,name] of OS){

let buttons="";

for(const arch of ARCHS){

const asset=releaseAsset(
release,
os,
arch
);

if(!asset)
continue;

buttons+=linkHTML(
asset.browser_download_url||asset.url,
arch,
`<span class="asset-name">${esc(asset.name)}</span>`
);
}

if(!buttons)
continue;

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

${release.prerelease?`
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

const box=
document.getElementById("releases");

try{

const releases=
await getAll(RELEASE_URL);

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

const url=
`${WORKFLOW_URL}`+
`?branch=${encodeURIComponent(BRANCH)}`+
`&event=${encodeURIComponent(EVENT)}`+
`&status=${encodeURIComponent(STATUS)}`;

const runs=
await getAll(url,"workflow_runs");

return runs
.filter(run=>
run.event===EVENT&&
run.head_branch===BRANCH&&
run.status==="completed"&&
run.conclusion===STATUS
)
.sort((a,b)=>
new Date(b.created_at)-
new Date(a.created_at)
);
}

async function getArtifacts(runId){

const data=await get(
`${RUNS_URL}/${runId}/artifacts?per_page=${PER_PAGE}`
);

return data.artifacts||[];
}

function makeArtifactMap(artifacts){

const result={};

for(const artifact of artifacts){

if(artifact.expired)
continue;

const match=
artifact.name.match(ARTIFACT_PATTERN);

if(!match)
continue;

result[
`${match[1]}:${match[2]}`
]=artifact;
}

return result;
}

function renderSnapshot(run,artifacts){

const map=
makeArtifactMap(artifacts);

let systems="";

for(const [os,name] of OS){

let buttons="";

for(const arch of ARCHS){

const artifact=
map[`${os}:${arch}`];

if(!artifact)
continue;

buttons+=linkHTML(
`${GH}/actions/runs/${run.id}/artifacts/${artifact.id}`,
arch
);
}

if(!buttons)
continue;

systems+=`
<div class="os">

<div class="os-title">
${esc(name)}
</div>

<div class="buttons">
${buttons}
</div>

</div>
`;
}

if(!systems)
return "";

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

${systems}

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

const box=
document.getElementById("snapshots");

try{

const runs=
await getAllSuccessfulRuns();

const snapshots=
await Promise.all(
runs.map(async run=>{

try{

return{
run,
artifacts:
await getArtifacts(run.id)
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

const rendered=
renderSnapshot(
snapshot.run,
snapshot.artifacts
);

if(!rendered)
continue;

html+=rendered;
count++;
}

box.innerHTML=html||`
<div class="empty">
No downloadable snapshots found.
</div>
`;

document.getElementById(
"snapshot-count"
).textContent=`(${count})`;

}catch(e){

box.innerHTML=errorHTML(e);
}
}

async function load(){

const releases=
document.getElementById("releases");

const snapshots=
document.getElementById("snapshots");

document.getElementById("status").textContent=
githubKey?
"Fetching versions with GitHub authentication…":
"Fetching versions…";

releases.innerHTML=
loadingHTML("Loading releases…");

snapshots.innerHTML=
loadingHTML("Loading snapshots…");

await Promise.allSettled([
loadReleases(),
loadSnapshots()
]);

const r=
document.getElementById(
"release-count"
).textContent||"(0)";

const s=
document.getElementById(
"snapshot-count"
).textContent||"(0)";

document.getElementById("status").textContent=
`${r.slice(1,-1)} releases · ${s.slice(1,-1)} snapshots`;
}

function setGitHubKey(key){
githubKey=String(key||"").trim();
}

function getCookieKey(){

const prefix=
COOKIE_NAME+"=";

for(const part of document.cookie.split(";")){

const item=part.trim();

if(!item.startsWith(prefix))
continue;

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

if(!key)
return;

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

function renderPlatformOptions(){

const osBox=document.getElementById("dev-os");
const archBox=document.getElementById("dev-arch");

osBox.innerHTML=OS.map(([id,name])=>`
<label>
<input
type="checkbox"
name="dev-os"
value="${esc(id)}"
checked
>
${esc(name)}
</label>
`).join("");

archBox.innerHTML=ARCHS.map(arch=>`
<label>
<input
type="checkbox"
name="dev-arch"
value="${esc(arch)}"
checked
>
${esc(arch)}
</label>
`).join("");
}

function applyPlatformOptions(){

const os=[
...document.querySelectorAll(
'input[name="dev-os"]:checked'
)
].map(x=>{

const found=OS.find(o=>o[0]===x.value);

return found;
}).filter(Boolean);

const archs=[
...document.querySelectorAll(
'input[name="dev-arch"]:checked'
)
].map(x=>x.value);

if(!os.length||!archs.length){

devStatus.textContent=
"Select at least one OS and architecture.";

return;
}

OS.length=0;
OS.push(...os);

ARCHS.length=0;
ARCHS.push(...archs);

devStatus.textContent=
"Platform filters applied. Reloading…";

location.reload();
}

renderPlatformOptions();

document.getElementById(
"apply-platforms"
).addEventListener(
"click",
applyPlatformOptions
);

document.getElementById(
"reload-key"
).addEventListener(
"click",
()=>{

const key=
keyInput.value.trim();

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

const key=
keyInput.value.trim();

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

const key=
getCookieKey();

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