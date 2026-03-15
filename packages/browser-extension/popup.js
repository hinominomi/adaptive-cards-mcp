/**
 * Popup script — lightweight card generation
 */
const SCHEMA = "http://adaptivecards.io/schemas/adaptive-card.json";
const PATTERNS = {
  notification: { kw: ["notify","alert","message","deploy","build","announce"], build: d => ({
    "$schema":SCHEMA,type:"AdaptiveCard",version:"1.6",body:[{type:"TextBlock",text:d.split(/[.!?\n]/)[0].trim()||d,size:"medium",weight:"bolder",wrap:true,style:"heading"},{type:"TextBlock",text:d,wrap:true}]
  })},
  approval: { kw: ["approve","reject","request","expense","authorize"], build: d => ({
    "$schema":SCHEMA,type:"AdaptiveCard",version:"1.6",body:[{type:"TextBlock",text:d.split(/[.!?\n]/)[0].trim(),size:"large",weight:"bolder",wrap:true,style:"heading"},{type:"FactSet",facts:[{title:"Requester",value:"Name"},{title:"Amount",value:"$0"},{title:"Status",value:"Pending"}]}],actions:[{type:"Action.Execute",title:"Approve",style:"positive",verb:"approve"},{type:"Action.Execute",title:"Reject",style:"destructive",verb:"reject"}]
  })},
  form: { kw: ["form","input","survey","register","signup","feedback"], build: d => ({
    "$schema":SCHEMA,type:"AdaptiveCard",version:"1.6",body:[{type:"TextBlock",text:d.split(/[.!?\n]/)[0].trim(),size:"medium",weight:"bolder",wrap:true,style:"heading"},{type:"Input.Text",id:"name",label:"Name",placeholder:"Enter name..."},{type:"Input.Text",id:"details",label:"Details",isMultiline:true,placeholder:"Enter details..."}],actions:[{type:"Action.Execute",title:"Submit",style:"positive",verb:"submit"}]
  })},
  table: { kw: ["table","data","rows","columns","grid","spreadsheet","tabular","list"], build: d => ({
    "$schema":SCHEMA,type:"AdaptiveCard",version:"1.6",body:[{type:"TextBlock",text:d.split(/[.!?\n]/)[0].trim(),size:"medium",weight:"bolder",wrap:true,style:"heading"},{type:"Table",firstRowAsHeader:true,showGridLines:true,gridStyle:"accent",columns:[{width:1},{width:1},{width:1}],rows:[{type:"TableRow",cells:[{type:"TableCell",items:[{type:"TextBlock",text:"Column 1",weight:"bolder",wrap:true}]},{type:"TableCell",items:[{type:"TextBlock",text:"Column 2",weight:"bolder",wrap:true}]},{type:"TableCell",items:[{type:"TextBlock",text:"Column 3",weight:"bolder",wrap:true}]}]},{type:"TableRow",cells:[{type:"TableCell",items:[{type:"TextBlock",text:"Value 1",wrap:true}]},{type:"TableCell",items:[{type:"TextBlock",text:"Value 2",wrap:true}]},{type:"TableCell",items:[{type:"TextBlock",text:"Value 3",wrap:true}]}]}]}]
  })},
  facts: { kw: ["detail","info","summary","status","properties","metadata","facts","key-value"], build: d => ({
    "$schema":SCHEMA,type:"AdaptiveCard",version:"1.6",body:[{type:"TextBlock",text:d.split(/[.!?\n]/)[0].trim(),size:"medium",weight:"bolder",wrap:true,style:"heading"},{type:"FactSet",facts:[{title:"Status",value:"Active"},{title:"Priority",value:"High"},{title:"Assigned To",value:"Team"},{title:"Created",value:new Date().toISOString().split("T")[0]}]}]
  })},
  dashboard: { kw: ["dashboard","metrics","kpi","stats","analytics"], build: d => ({
    "$schema":SCHEMA,type:"AdaptiveCard",version:"1.6",body:[{type:"TextBlock",text:d.split(/[.!?\n]/)[0].trim(),size:"medium",weight:"bolder",wrap:true,style:"heading"},{type:"ColumnSet",columns:[{type:"Column",width:"stretch",items:[{type:"TextBlock",text:"Metric",isSubtle:true,wrap:true},{type:"TextBlock",text:"1,234",size:"extraLarge",weight:"bolder",color:"accent"}]},{type:"Column",width:"stretch",items:[{type:"TextBlock",text:"Metric",isSubtle:true,wrap:true},{type:"TextBlock",text:"89%",size:"extraLarge",weight:"bolder",color:"good"}]}]}]
  })},
  profile: { kw: ["profile","person","contact","user","member","employee"], build: d => ({
    "$schema":SCHEMA,type:"AdaptiveCard",version:"1.6",body:[{type:"ColumnSet",columns:[{type:"Column",width:"auto",items:[{type:"Image",url:"https://adaptivecards.io/content/cats/1.png",size:"large",style:"person",altText:"Profile photo"}]},{type:"Column",width:"stretch",items:[{type:"TextBlock",text:"Name",size:"large",weight:"bolder",wrap:true},{type:"TextBlock",text:"Title / Role",isSubtle:true,spacing:"none",wrap:true},{type:"TextBlock",text:"Organization",isSubtle:true,spacing:"none",wrap:true}]}]},{type:"FactSet",facts:[{title:"Email",value:"user@example.com"},{title:"Phone",value:"+1 (555) 000-0000"},{title:"Location",value:"City, Country"}]}],actions:[{type:"Action.OpenUrl",title:"View Profile",url:"https://example.com"}]
  })}
};

function generate(desc, host, intent) {
  const lower = desc.toLowerCase();
  if (intent !== "auto" && PATTERNS[intent]) return PATTERNS[intent].build(desc);
  let best = null, bestScore = 0;
  for (const [n, p] of Object.entries(PATTERNS)) {
    let s = 0;
    for (const k of p.kw) if (lower.includes(k)) s += 10;
    if (s > bestScore) { bestScore = s; best = n; }
  }
  return (best ? PATTERNS[best] : PATTERNS.notification).build(desc);
}

document.getElementById("generate").addEventListener("click", () => {
  const desc = document.getElementById("input").value.trim();
  if (!desc) { showStatus("Enter a description", "error"); return; }
  const host = document.getElementById("host").value;
  const intent = document.getElementById("intent").value;
  const card = generate(desc, host, intent);
  document.getElementById("output").textContent = JSON.stringify(card, null, 2);
  showStatus("Generated!", "success");
});

document.getElementById("copy").addEventListener("click", () => {
  const text = document.getElementById("output").textContent;
  if (!text) { showStatus("Nothing to copy", "error"); return; }
  navigator.clipboard.writeText(text).then(() => showStatus("Copied!", "success"));
});

function showStatus(msg, type) {
  const el = document.getElementById("status");
  el.textContent = msg;
  el.className = "status show " + type;
  setTimeout(() => el.classList.remove("show"), 3000);
}
