'use client';
import { useEffect, useRef, useState } from 'react';
import { chapters } from '@/data/chapters';
const clamp = (v:number) => Math.max(0,Math.min(1,v));
// Smootherstep keeps velocity and acceleration gentle at both ends.
const ease = (v:number) => v*v*v*(v*(v*6-15)+10);
export default function Story(){
  const world=useRef<HTMLDivElement>(null), bar=useRef<HTMLDivElement>(null);
  const scenes=useRef<(HTMLDivElement|null)[]>([]);
  const activeRef=useRef(0), focusRef=useRef(false), reducedRef=useRef(false);
  const [active,setActive]=useState(0), [focused,setFocused]=useState(false);
  const go=(i:number)=>{focusRef.current=false;setFocused(false);document.getElementById(chapters[Math.max(0,Math.min(9,i))].id)?.scrollIntoView({behavior:reducedRef.current?'instant':'smooth'});};
  useEffect(()=>{
    const media=matchMedia('(prefers-reduced-motion: reduce)');
    const preference=()=>{reducedRef.current=media.matches;};
    preference();media.addEventListener('change',preference);
    let frame=0,current=scrollY,mx=0,my=0,px=0,py=0,last=0,focusZoom=0;
    const move=(e:PointerEvent)=>{mx=(e.clientX/innerWidth-.5)*2;my=(e.clientY/innerHeight-.5)*2;};
    const leave=()=>{mx=0;my=0;};
    const render=(time:number)=>{
      const dt=Math.min((time-last)/1000||.016,.05);last=time;
      const smoothing=1-Math.exp(-4*dt);
      current+=(scrollY-current)*smoothing;px+=(mx-px)*smoothing;py+=(my-py)*smoothing;
      focusZoom+=((focusRef.current ? .1 : 0)-focusZoom)*(1-Math.exp(-3*dt));
      const position=Math.max(0,Math.min(9,current/(innerHeight*2.3)));
      const base=Math.floor(position), local=position-base;
      const transition=ease(clamp((local-.3)/.7));
      const selected=Math.min(9,base+(transition>=.5?1:0)), quiet=reducedRef.current;
      if(selected!==activeRef.current){activeRef.current=selected;setActive(selected);focusRef.current=false;setFocused(false);}
      scenes.current.forEach((scene,i)=>{
        if(!scene)return;
        const outgoing=i===base,incoming=i===base+1;
        const opacity=quiet?(i===selected?1:0):outgoing?1-transition:incoming?transition:0;
        scene.style.visibility=opacity>.001?'visible':'hidden';scene.style.setProperty('--reveal',String(opacity));
        if(opacity<.001)return;
        const zoom=outgoing?1+local*.035+transition*.16:1.14-transition*.14;
        scene.style.setProperty('--zoom',String(quiet ? 1 : zoom + focusZoom));
        scene.style.setProperty('--camera-x',(quiet?0:outgoing?-transition*3:(1-transition)*2)+'%');
        scene.style.setProperty('--softness',(quiet?0:Math.sin(transition*Math.PI)*3)+'px');
        scene.style.setProperty('--copy-opacity',String(quiet?1:outgoing?1-ease(clamp(transition/.55)):ease(clamp((transition-.4)/.6))));
        scene.style.setProperty('--copy-y',(quiet?0:outgoing?-transition*18:(1-transition)*18)+'px');
      });
      world.current?.style.setProperty('--pointer-x',(quiet?0:px*8)+'px');world.current?.style.setProperty('--pointer-y',(quiet?0:py*6)+'px');
      world.current?.style.setProperty('--tilt',(quiet?0:px*-.8)+'deg');world.current?.style.setProperty('--travel',String(position));
      world.current?.style.setProperty('--bridge',String(quiet?0:Math.sin(transition*Math.PI)*.22));
      if(bar.current)bar.current.style.transform='scaleX('+position/9+')';
      frame=requestAnimationFrame(render);
    };
    frame=requestAnimationFrame(render);addEventListener('pointermove',move,{passive:true});document.addEventListener('pointerleave',leave);
    const key=(e:KeyboardEvent)=>{if(e.target instanceof HTMLElement&&['BUTTON','A','INPUT'].includes(e.target.tagName))return;
      if(e.key==='ArrowRight'){e.preventDefault();go(activeRef.current+1);}if(e.key==='ArrowLeft'){e.preventDefault();go(activeRef.current-1);}if(e.key==='Escape'){focusRef.current=false;setFocused(false);}};
    addEventListener('keydown',key);
    return()=>{cancelAnimationFrame(frame);removeEventListener('pointermove',move);document.removeEventListener('pointerleave',leave);removeEventListener('keydown',key);media.removeEventListener('change',preference);};
  },[]);
  return <main className="immersive">
    <a className="skip" href="#journey-controls">Skip to navigation</a>
    <div className="world" ref={world} aria-hidden="true">
      {chapters.map((c,i)=><div className="world-scene" key={c.id} ref={el=>{scenes.current[i]=el;}} style={{visibility:i?'hidden':'visible'}}>
        <div className="scene-space">
          <div className="scene-atmosphere"><img src={'/story/'+c.image+'.webp'} alt="" /></div>
          <div className="scene-art"><img src={'/story/'+c.image+'.webp'} alt="" fetchPriority={i===0?'high':'auto'} /></div>
          <div className="depth-lines"><i/><i/><i/></div>
        </div>
        <div className="scene-shade"/>
        <div className="scene-words"><span className="scene-eyebrow">{c.label}</span><div className="scene-title">{c.title}</div><p>{c.copy}</p>{[0,7,8,9].includes(i)&&<div className="result-signature"><span>Web3</span><i/><span>RaaS</span><small>Result as a Service</small></div>}{i===8&&<div className="result-path"><span>Evidence</span><i>↗</i><span>Provenance</span><i>↗</i><span>Result</span></div>}</div>
      </div>)}
      <div className="transition-glow"/><div className="particles">{Array.from({length:18},(_,i)=><i key={i} style={{left:(i*43%97)+'%',top:(i*31%91)+'%','--depth':(i%4+1)*.3} as React.CSSProperties}/>)}</div><div className="world-vignette"/>
    </div>
    <header className="immersive-header"><a href="#begin" aria-label="Astra-Via home"><img src="/astra-logo.svg" alt="Astra-Via" width="150" height="36"/></a><span>WEB3 · RESULT AS A SERVICE</span><button onClick={()=>go(9)}>Explore Astra ↗</button></header>
    <div className="journey-distance" aria-label="Astra-Via story">{chapters.map((c,i)=><section className="journey-stop" id={c.id} key={c.id} aria-label={c.label}><div className="screen-reader-copy">{i===0?<h1>{c.title}</h1>:<h2>{c.title}</h2>}<p>{c.copy}</p><p>{c.detail}</p></div></section>)}</div>
    <div className="focus-point"><button className="focus-target" onClick={()=>{focusRef.current=!focusRef.current;setFocused(focusRef.current);}} aria-expanded={focused} aria-controls="focus-caption" aria-label={focused?'Zoom out of scene':'Move closer to this scene'}><span/>{focused?'Pull back':'Look closer'}</button>{focused&&<p id="focus-caption">{chapters[active].detail}</p>}</div>
    <footer className="journey-controls" id="journey-controls">
      <div className="journey-status" aria-live="polite"><span>{String(active+1).padStart(2,'0')} <small>/ 10</small></span><p>{chapters[active].label}</p></div>
      <nav aria-label="Jump to a scene">{chapters.map((c,i)=><button key={c.id} aria-label={'Scene '+(i+1)+': '+c.label} aria-current={i===active?'step':undefined} onClick={()=>go(i)}><i/></button>)}</nav>
      <div className="journey-direction"><button onClick={()=>go(active-1)} disabled={active===0} aria-label="Previous scene">↑</button><span>{active===9?'Scroll up to revisit':'Scroll to move through the story'}</span><button onClick={()=>go(active+1)} disabled={active===9} aria-label="Next scene">↓</button></div>
    </footer><div className="journey-progress"><i ref={bar}/></div>
  </main>;
}
