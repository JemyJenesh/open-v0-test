export const EDITOR_SCRIPT = `
<script>
(function(){
  if(window.parent===window)return;
  if(window.__editorLoaded)return;
  window.__editorLoaded=true;

  let editMode=false;
  let idCounter=0;

  function sendContext(){
    window.parent.postMessage({
      type:"demo-context",
      context:{
        route:window.location.pathname,
        scrollPosition:{x:window.scrollX,y:window.scrollY},
        viewport:{width:window.innerWidth,height:window.innerHeight}
      }
    },"*");
  }

  function getCommonValues(tagName){
    const props=["fontSize","color","backgroundColor","padding","margin","width","height"];
    const counts={};
    props.forEach(p=>counts[p]=new Map());
    document.querySelectorAll(tagName.toLowerCase()).forEach(el=>{
      const s=window.getComputedStyle(el);
      props.forEach(p=>{
        const v=s[p];
        counts[p].set(v,(counts[p].get(v)||0)+1);
      });
    });
    const result={};
    props.forEach(p=>{
      const sorted=Array.from(counts[p].entries()).sort((a,b)=>{
        const aNum=parseFloat(a[0]),bNum=parseFloat(b[0]);
        if(!isNaN(aNum)&&!isNaN(bNum))return aNum-bNum;
        return a[0].localeCompare(b[0]);
      });
      result[p]=sorted.slice(0,10).map(([v,c])=>({value:v,label:c>2?v+" ("+c+"x)":v}));
    });
    return result;
  }

  document.addEventListener("click",function(e){
    if(!editMode)return;
    e.preventDefault();
    e.stopPropagation();
    const t=e.target;
    if(!t.dataset.elementId)t.dataset.elementId="el-"+(++idCounter);
    const cs=window.getComputedStyle(t);
    const rect=t.getBoundingClientRect();
    let text="";
    for(const n of t.childNodes)if(n.nodeType===3)text+=n.textContent;
    text=text.trim();
    const textContent=text||(t.children.length>0?"["+t.children.length+" children]":"");
    const commonValues=getCommonValues(t.tagName);
    window.parent.postMessage({
      type:"element-click",
      element:{
        elementId:t.dataset.elementId,
        tagName:t.tagName,
        id:t.id,
        className:t.className,
        textContent:textContent,
        rect:{top:rect.top,left:rect.left,width:rect.width,height:rect.height},
        computedStyle:{
          color:cs.color,backgroundColor:cs.backgroundColor,fontSize:cs.fontSize,
          fontWeight:cs.fontWeight,padding:cs.padding,margin:cs.margin,
          width:cs.width,height:cs.height,display:cs.display,position:cs.position
        },
        commonValues:commonValues
      }
    },"*");
  },true);

  window.addEventListener("message",function(e){
    if(e.data.type==="set-mode"){
      editMode=e.data.mode==="edit";
      document.body.style.cursor=editMode?"crosshair":"";
    }else if(e.data.type==="update-properties"){
      const el=document.querySelector('[data-element-id="'+e.data.elementId+'"]');
      if(el){
        const p=e.data.properties;
        if(p.color)el.style.color=p.color;
        if(p.backgroundColor)el.style.backgroundColor=p.backgroundColor;
        if(p.fontSize)el.style.fontSize=p.fontSize;
        if(p.width)el.style.width=p.width;
        if(p.height)el.style.height=p.height;
        if(p.padding)el.style.padding=p.padding;
        if(p.margin)el.style.margin=p.margin;
        if(p.textContent!==undefined&&!p.textContent.startsWith("["))el.textContent=p.textContent;
      }
    }
  });

  window.addEventListener("scroll",sendContext);
  window.addEventListener("resize",sendContext);
  sendContext();

  let lastPath=window.location.pathname;
  setInterval(function(){
    if(window.location.pathname!==lastPath){
      lastPath=window.location.pathname;
      window.parent.postMessage({type:"route-changed",route:lastPath},"*");
      sendContext();
    }
  },100);
})();
</script>
`;
