// Anchored single-choice menu for the visible role selector.
// No bottom sheet: the downward chevron means options open by the trigger.
let active=null,sequence=0;
export function closeRoleMenu({restoreFocus=false}={}){
 if(!active)return;
 const {trigger,menu,cleanup}=active;
 active=null;
 cleanup();
 menu.remove();
 trigger.setAttribute('aria-expanded','false');
 trigger.removeAttribute('aria-controls');
 if(restoreFocus&&trigger.isConnected)trigger.focus({preventScroll:true});
}
export function openRoleMenu(trigger,roles,current,onSelect){
 if(!trigger?.isConnected||!Array.isArray(roles)||!roles.length)return;
 if(active?.trigger===trigger){closeRoleMenu({restoreFocus:true});return;}
 closeRoleMenu();
 const menu=document.createElement('div');
 menu.id='role-menu-'+(++sequence);
 menu.className='role-menu';
 menu.setAttribute('role','listbox');
 menu.setAttribute('aria-label','担当する役');
 const buttons=roles.map(role=>{
  const option=document.createElement('button');
  option.type='button';
  option.className='role-menu-option';
  option.setAttribute('role','option');
  option.setAttribute('aria-selected',String(role===current));
  const name=document.createElement('span');
  name.className='role-menu-name';
  name.textContent=role;
  option.append(name);
  if(role===current){
   const check=document.createElement('span');
   check.className='role-menu-check';
   check.setAttribute('aria-hidden','true');
   check.textContent='✓';
   option.append(check);
  }
  option.onclick=()=>{
   closeRoleMenu();
   if(role!==current)onSelect(role);
   else if(trigger.isConnected)trigger.focus({preventScroll:true});
  };
  menu.append(option);
  return option;
 });
 document.body.append(menu);
 trigger.setAttribute('aria-haspopup','listbox');
 trigger.setAttribute('aria-expanded','true');
 trigger.setAttribute('aria-controls',menu.id);
 const padding=12;
 const position=()=>{
  if(!trigger.isConnected){closeRoleMenu();return;}
  const r=trigger.getBoundingClientRect();
  const height=window.innerHeight,width=window.innerWidth;
  const menuWidth=Math.min(280,width-padding*2);
  const desiredHeight=Math.min(menu.scrollHeight,340,height-padding*2);
  const below=height-r.bottom-padding-6,above=r.top-padding-6;
  const openAbove=below<Math.min(170,desiredHeight)&&above>below;
  const available=Math.max(100,openAbove?above:below);
  const menuHeight=Math.min(desiredHeight,available);
  menu.style.width=menuWidth+'px';
  menu.style.maxHeight=menuHeight+'px';
  menu.style.left=Math.max(padding,Math.min(r.right-menuWidth,width-padding-menuWidth))+'px';
  menu.style.top=(openAbove?Math.max(padding,r.top-menuHeight-6):Math.min(height-padding-menuHeight,r.bottom+6))+'px';
 };
 const onPointer=e=>{if(!menu.contains(e.target)&&!trigger.contains(e.target))closeRoleMenu();};
 const onKey=e=>{
  if(e.key==='Escape'){e.preventDefault();closeRoleMenu({restoreFocus:true});return;}
  if(!menu.contains(document.activeElement))return;
  if(e.key==='Tab'){closeRoleMenu();return;}
  const i=buttons.indexOf(document.activeElement);
  let next=null;
  if(e.key==='ArrowDown')next=(i+1)%buttons.length;
  if(e.key==='ArrowUp')next=(i+buttons.length-1)%buttons.length;
  if(e.key==='Home')next=0;
  if(e.key==='End')next=buttons.length-1;
  if(next!==null){e.preventDefault();buttons[next].focus({preventScroll:true});}
 };
 const onViewport=e=>{if(e.target===menu||menu.contains(e.target))return;closeRoleMenu();};
 const cleanup=()=>{
  document.removeEventListener('pointerdown',onPointer,true);
  document.removeEventListener('keydown',onKey,true);
  window.removeEventListener('resize',onViewport);
  window.removeEventListener('scroll',onViewport,true);
 };
 active={trigger,menu,cleanup};
 document.addEventListener('pointerdown',onPointer,true);
 document.addEventListener('keydown',onKey,true);
 window.addEventListener('resize',onViewport);
 window.addEventListener('scroll',onViewport,true);
 position();
 (buttons.find(option=>option.getAttribute('aria-selected')==='true')||buttons[0]).focus({preventScroll:true});
}
