const REPO="Bixilon/Minosoft";
const BRANCH="master";
const WORKFLOW="build.yml";
const EVENT="push";
const STATUS="success";
const PER_PAGE=100;
const ARTIFACT_PREFIX="minosoft";
const COOKIE_NAME="minosoft_github_key";
const PLATFORM_STORAGE="minosoft_platforms";
const THROBBER="throbber.gif";

const DEFAULT_OS=[
["ubuntu","Linux"],
["windows","Windows"],
["dummytest1","Dummy"],
["macos","macOS"]
];

const DEFAULT_ARCHS=[
"amd64",
"dummytest2",
"aarch64"
];

const OS=[];
const ARCHS=[];

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

function loadPlatforms(){

let saved;

try{
saved=JSON.parse(
localStorage.getItem(PLATFORM_STORAGE)
);
}catch{
saved=null;
}

OS.length=0;
ARCHS.length=0;

if(
saved&&
Array.isArray(saved.os)&&
Array.isArray(saved.archs)&&
saved.os.length&&
saved.archs.length
){

for(const item of saved.os){

if(
Array.isArray(item)&&
item.length>=2&&
String(item[0]).trim()&&
String(item[1]).trim()
){

OS.push([
String(item[0]).trim(),
String(item[1]).trim()
]);

}
}

for(const arch of saved.archs){

if(String(arch).trim())
ARCHS.push(
String(arch).trim()
);

}

}

if(!OS.length)
OS.push(...DEFAULT_OS);

if(!ARCHS.length)
ARCHS.push(...DEFAULT_ARCHS);
}

function savePlatforms(){

try{

localStorage.setItem(
PLATFORM_STORAGE,
JSON.stringify({
os:OS,
archs:ARCHS
})
);

}catch(e){

console.warn(
"Could not save platform settings:",
e
);

}
}

loadPlatforms();

function artifactPattern(){

const osPattern=
OS.map(x=>escapeRegex(x[0])).join("|");

const archPattern=
ARCHS.map(escapeRegex).join("|");

return new RegExp(
`^${escapeRegex(ARTIFACT_PREFIX)}-(${osPattern})-(${archPattern})$`
);
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

if(githubKey)
headers["Authorization"]=
`Bearer ${githubKey}`;

const response=
await fetch(url,{headers});

const body=
await response.text();

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

const e=
new Error("Response was not valid JSON");

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

const separator=
url.includes("?")?"&":"?";

const data=
await get(
`${url}${separator}per_page=${PER_PAGE}&page=${page}`
);

const items=
key?data[key]:data;

if(
!Array.isArray(items)||
!items.length
)
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

const name=
(asset.name||"").toLowerCase();

return(
name.includes(os.toLowerCase())&&
name.includes(arch.toLowerCase())
);

});
}

function renderRelease(release){

let systems="";

for(const [os,name] of OS){

let buttons="";

for(const arch of ARCHS){

const asset=
releaseAsset(
release,
os,
arch
);

if(!asset)
continue;

buttons+=linkHTML(
asset.browser_download_url||
asset.url,
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

systems+=`
<small class="tip">
Tip: Want to run Minosoft on Android? Download the <b>Linux AARCH64</b> version, extract the ZIP, then open the <b>.jar</b> file with a Java emulator (NOT J2ME!) using its <b>“Open as Swing App”</b> option.
</small>
`;

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

if(!box)
return;

try{

const releases=
await getAll(RELEASE_URL);

const count=
document.getElementById("release-count");

if(count)
count.textContent=
`(${releases.length})`;

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

box.innerHTML=
errorHTML(e);

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

const data=
await get(
`${RUNS_URL}/${runId}/artifacts?per_page=${PER_PAGE}`
);

return data.artifacts||[];
}

function makeArtifactMap(artifacts){

const result={};
const pattern=artifactPattern();

for(const artifact of artifacts){

if(artifact.expired)
continue;

const match=
artifact.name.match(pattern);

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

if(!box)
return;

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

box.innerHTML=
html||`
<div class="empty">
No downloadable snapshots found.
</div>
`;

const countBox=
document.getElementById(
"snapshot-count"
);

if(countBox)
countBox.textContent=
`(${count})`;

}catch(e){

box.innerHTML=
errorHTML(e);

}
}

async function load(){

const releases=
document.getElementById("releases");

const snapshots=
document.getElementById("snapshots");

if(!releases||!snapshots)
return;

const status=
document.getElementById("status");

if(status){

status.textContent=
githubKey?
"Fetching versions with GitHub authentication…":
"Fetching versions…";

}

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
)?.textContent||"(0)";

const s=
document.getElementById(
"snapshot-count"
)?.textContent||"(0)";

if(status){

status.textContent=
`${r.slice(1,-1)} releases · ${s.slice(1,-1)} snapshots`;

}

}

function setGitHubKey(key){

githubKey=
String(key||"").trim();

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

function devMessage(text){

if(devStatus)
devStatus.textContent=text;

}

function renderPlatformOptions(){

const osBox=
document.getElementById("dev-os");

const archBox=
document.getElementById("dev-arch");

/*
Developer Options are optional.

If the HTML does not contain either
platform container, simply do nothing.
The rest of the website continues normally.
*/

if(!osBox&&!archBox)
return;

if(osBox){

osBox.innerHTML=`
<div class="platform-list">

${OS.map(([id,name])=>`
<label>

<input
type="checkbox"
name="dev-os"
value="${esc(id)}"
checked
>

${esc(name)}
<code>${esc(id)}</code>

</label>
`).join("")}

</div>

<div class="platform-add">

<button
type="button"
id="add-os"
>
Add OS
</button>

</div>
`;

const addOS=
document.getElementById("add-os");

if(addOS){

addOS.addEventListener(
"click",
()=>{

const id=
prompt(
"OS identifier used in artifact names:"
);

if(!id)
return;

const cleanId=
id.trim().toLowerCase();

if(!/^[a-z0-9_-]+$/.test(cleanId)){

devMessage(
"Invalid OS identifier."
);

return;
}

if(OS.some(x=>x[0]===cleanId)){

devMessage(
"That OS already exists."
);

return;
}

const name=
prompt(
"Display name for this OS:",
cleanId
);

if(!name||!name.trim())
return;

OS.push([
cleanId,
name.trim()
]);

savePlatforms();
renderPlatformOptions();

devMessage(
`Added OS: ${name.trim()}`
);

}
);

}

}

if(archBox){

archBox.innerHTML=`
<div class="platform-list">

${ARCHS.map(arch=>`
<label>

<input
type="checkbox"
name="dev-arch"
value="${esc(arch)}"
checked
>

${esc(arch)}

</label>
`).join("")}

</div>

<div class="platform-add">

<button
type="button"
id="add-arch"
>
Add architecture
</button>

</div>
`;

const addArch=
document.getElementById("add-arch");

if(addArch){

addArch.addEventListener(
"click",
()=>{

const value=
prompt(
"Architecture identifier:"
);

if(!value)
return;

const arch=
value.trim().toLowerCase();

if(!/^[a-z0-9_-]+$/.test(arch)){

devMessage(
"Invalid architecture identifier."
);

return;
}

if(ARCHS.includes(arch)){

devMessage(
"That architecture already exists."
);

return;
}

ARCHS.push(arch);

savePlatforms();
renderPlatformOptions();

devMessage(
`Added architecture: ${arch}`
);

}
);

}

}

}

function applyPlatformOptions(){

const osInputs=
document.querySelectorAll(
'input[name="dev-os"]'
);

const archInputs=
document.querySelectorAll(
'input[name="dev-arch"]'
);

/*
If Developer Options HTML isn't present,
there is nothing to apply.
*/

if(!osInputs.length&&!archInputs.length)
return;

const selectedOS=[
...document.querySelectorAll(
'input[name="dev-os"]:checked'
)
]
.map(input=>
OS.find(
os=>os[0]===input.value
)
)
.filter(Boolean);

const selectedArchs=[
...document.querySelectorAll(
'input[name="dev-arch"]:checked'
)
]
.map(input=>input.value);

if(
!selectedOS.length||
!selectedArchs.length
){

devMessage(
"Select at least one OS and architecture."
);

return;
}

OS.length=0;
OS.push(...selectedOS);

ARCHS.length=0;
ARCHS.push(...selectedArchs);

savePlatforms();

devMessage(
"Platform settings applied. Reloading…"
);

load();

}

renderPlatformOptions();

const applyPlatforms=
document.getElementById(
"apply-platforms"
);

if(applyPlatforms){

applyPlatforms.addEventListener(
"click",
applyPlatformOptions
);

}

const reloadKey=
document.getElementById(
"reload-key"
);

if(reloadKey){

reloadKey.addEventListener(
"click",
()=>{

if(!keyInput){

devMessage(
"GitHub API key input is unavailable."
);

return;
}

const key=
keyInput.value.trim();

if(!key){

devMessage(
"Enter a GitHub API key first."
);

return;
}

setGitHubKey(key);

devMessage(
"Reloading with the entered GitHub API key…"
);

load();

}
);

}

const storeKey=
document.getElementById(
"store-key"
);

if(storeKey){

storeKey.addEventListener(
"click",
()=>{

if(!keyInput){

devMessage(
"GitHub API key input is unavailable."
);

return;
}

const key=
keyInput.value.trim();

if(!key){

devMessage(
"Enter a GitHub API key first."
);

return;
}

storeCookieKey(key);

devMessage(
"GitHub API key stored in this browser."
);

}
);

}

const reloadCookie=
document.getElementById(
"reload-cookie"
);

if(reloadCookie){

reloadCookie.addEventListener(
"click",
()=>{

const key=
getCookieKey();

if(!key){

devMessage(
"No stored GitHub API key was found."
);

return;
}

setGitHubKey(key);

if(keyInput)
keyInput.value=key;

devMessage(
"Reloading with the stored GitHub API key…"
);

load();

}
);

}

const resetCookieButton=
document.getElementById(
"reset-cookie"
);

if(resetCookieButton){

resetCookieButton.addEventListener(
"click",
()=>{

resetCookie();
setGitHubKey("");

if(keyInput)
keyInput.value="";

devMessage(
"Stored GitHub API key removed."
);

}
);

}

const showKey=
document.getElementById("show-key");

if(showKey&&keyInput){

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

}

const refresh=
document.getElementById("refresh");

if(refresh){

refresh.addEventListener(
"click",
()=>{

setGitHubKey("");

if(keyInput)
keyInput.value="";

load();

}
);

}

load();