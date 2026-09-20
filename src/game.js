import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createPond } from './pond.js';
import { createMiniatureLens } from './miniature.js';
import { createSoundscape } from './soundscape.js';
import { terrainHeight, coastDistance, MIN_LEVEL, MAX_LEVEL } from './terrain.js';

const container = document.querySelector('#scene');
const loading = document.querySelector('#loading');
const card = document.querySelector('#story-card');
const cardTitle = document.querySelector('#story-title');
const cardCopy = document.querySelector('#story-copy');
const hint = document.querySelector('#hint');
const soundButton = document.querySelector('#sound-toggle');
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const clock = new THREE.Clock();
const interactive = [];
const ducks = [];
const creatures = [];
let soundOn = false, activeStory = false;
const soundscape=createSoundscape(enabled=>{soundOn=enabled;updateSoundIcon();});

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = .96;
container.append(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#dfeae4');
scene.fog = new THREE.Fog('#dfeae4', 45, 80);
const camera = new THREE.OrthographicCamera(-9, 9, 9, -9, .1, 100);
camera.position.set(11, 13, 15); camera.lookAt(0, 0, 0);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0,-.55,0);
controls.enableDamping = true;
controls.dampingFactor = .08;
controls.enablePan = true;
controls.screenSpacePanning = true;
controls.mouseButtons = {LEFT:THREE.MOUSE.ROTATE,MIDDLE:THREE.MOUSE.DOLLY,RIGHT:THREE.MOUSE.PAN};
controls.touches = {ONE:THREE.TOUCH.ROTATE,TWO:THREE.TOUCH.DOLLY_PAN};
renderer.domElement.addEventListener('contextmenu',event=>event.preventDefault());
controls.minPolarAngle = Math.PI / 10;
controls.maxPolarAngle = Math.PI / 2.5;
controls.minZoom = .8;
controls.maxZoom = 3.8;
controls.rotateSpeed = .65;
controls.zoomSpeed = .8;
renderer.domElement.style.touchAction = 'none';

const hemi = new THREE.HemisphereLight('#eaf8e6', '#6c836c', 2.4); scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff1c8', 3.1); sun.position.set(-8, 13, 5); sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.left = -11; sun.shadow.camera.right = 11; sun.shadow.camera.top = 11; sun.shadow.camera.bottom = -11; scene.add(sun);

const world = new THREE.Group(); scene.add(world);
const mats = {
  grass: new THREE.MeshStandardMaterial({ color: '#85a96c', roughness: .92, flatShading: true }),
  darkGrass: new THREE.MeshStandardMaterial({ color: '#5f885c', roughness: .95, flatShading: true }),
  soil: new THREE.MeshStandardMaterial({ color: '#987b55', roughness: 1, flatShading: true }),
  rock: new THREE.MeshStandardMaterial({ color: '#a5a591', roughness: .9, flatShading: true }),
  bark: new THREE.MeshStandardMaterial({ color: '#746047', roughness: 1, flatShading: true }),
  leaf: new THREE.MeshStandardMaterial({ color: '#4e8058', roughness: .8, flatShading: true }),
  leafLight: new THREE.MeshStandardMaterial({ color: '#79a468', roughness: .8, flatShading: true }),
  reed: new THREE.MeshStandardMaterial({ color: '#547c52', roughness: .9, flatShading: true }),
};

function mesh(geo, mat, pos, scale = 1, parent = world) { const m = new THREE.Mesh(geo, mat); m.position.copy(pos); if (typeof scale === 'number') m.scale.setScalar(scale); else if (Array.isArray(scale)) m.scale.fromArray(scale); else m.scale.copy(scale); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; }
function circleShape(points) { const shape = new THREE.Shape(); points.forEach(([x, y], i) => i ? shape.lineTo(x, y) : shape.moveTo(x, y)); shape.closePath(); return shape; }
function stone(x, z, size = 1) { const s = mesh(new THREE.DodecahedronGeometry(1, 0), mats.rock, new THREE.Vector3(x, .26, z), new THREE.Vector3(size * 1.05, size * .55, size)); s.rotation.set(Math.random(), Math.random(), Math.random()); return s; }

const lens = createMiniatureLens(renderer,camera,controls);
const pond = createPond(world,renderer,scene,camera,()=>lens.render(scene));
interactive.push(pond.surface,...pond.bottles);

function tree(x, z, s = 1) { const g = new THREE.Group(); g.position.set(x, terrainHeight(x,z), z); world.add(g); const trunk = mesh(new THREE.CylinderGeometry(.18*s,.26*s,1.5*s,6), mats.bark, new THREE.Vector3(0,.75*s,0), 1, g); trunk.rotation.z = (Math.random()-.5)*.12; for (const [dx,dy,dz,scale] of [[0,1.7,0,1],[.45,1.55,.1,.7],[-.38,1.45,.22,.68],[.1,2.05,.15,.65]]) mesh(new THREE.DodecahedronGeometry(.72*s*scale, 1), Math.random()>.45 ? mats.leaf : mats.leafLight, new THREE.Vector3(dx*s,dy*s,dz*s), 1, g); }
[[-5,-3,1.35],[-3.4,-4,1.25],[-5.5,-.8,1],[-1.8,-4.5,.95],[-4,-1.8,1.15],[-5.6,1.7,.8],[-2.7,-2.1,.75]].forEach(p=>tree(...p));
function bush(x,z,s=1) { for (let i=0;i<4;i++) mesh(new THREE.DodecahedronGeometry(.42*s, 1), i%2 ? mats.leaf : mats.leafLight, new THREE.Vector3(x+(i%2-.5)*.4*s,terrainHeight(x,z)+.25+(i%3)*.12,z+(Math.floor(i/2)-.3)*.4*s)); }
[[-4.6,-4.5,.8],[-5.6,3.2,.75],[-2.6,-3.5,.7],[-4.3,.7,.7],[-1.7,-3.3,.55]].forEach(v=>bush(...v));
// Instanced meadow blades and flowers keep the shoreline richly planted without extra draw calls.
let randomSeed=8723;
function seeded(){randomSeed=(Math.imul(randomSeed,1664525)+1013904223)>>>0;return randomSeed/4294967296;}
const bladePositions=[],bladeIndices=[];
for(let j=0;j<=5;j++){
  const t=j/5,width=.075*(1-t)*(.65+Math.sin(t*Math.PI)*.35);
  const bend=.30*t*t;
  bladePositions.push(-width,.34*t,bend,width,.34*t,bend);
  if(j){const k=j*2;bladeIndices.push(k-2,k-1,k,k-1,k+1,k);}
}
const bladeGeometry=new THREE.BufferGeometry();
bladeGeometry.setAttribute('position',new THREE.Float32BufferAttribute(bladePositions,3));
bladeGeometry.setIndex(bladeIndices);bladeGeometry.computeVertexNormals();
const meadowMaterial=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.94,side:THREE.DoubleSide});
const grassTime={value:0},grassWind={value:.47};
meadowMaterial.onBeforeCompile=shader=>{
  shader.uniforms.uGrassTime=grassTime;shader.uniforms.uGrassWind=grassWind;
  shader.vertexShader='uniform float uGrassTime,uGrassWind;\n'+shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
    float phase=instanceMatrix[3].x*1.7+instanceMatrix[3].z;
    transformed.x+=sin(uGrassTime*1.6+phase)*position.y*position.y*(.12+uGrassWind*.45);
    transformed.z+=cos(uGrassTime*1.2+phase)*position.y*position.y*(.08+uGrassWind*.2);`);
};
const grassInstances=new THREE.InstancedMesh(bladeGeometry,meadowMaterial,14000);
const petalInstances=new THREE.InstancedMesh(new THREE.SphereGeometry(.045,6,4),new THREE.MeshStandardMaterial({roughness:.9}),800);
const dummy=new THREE.Object3D();
let bladeCount=0,petalCount=0;
for(let i=0;i<1300;i++){
  const x=-6.5+seeded()*12.6,z=-5.2+seeded()*10.2,d=coastDistance(x,z);
  if(d>1.1 || d< -6.2 || seeded()>(d>-.65?.14:.52)) continue;
  const h=terrainHeight(x,z);
  const tuftSize=.55+seeded()*.75;
  const tuftColor=new THREE.Color(d>-.65?'#858965':i%3?'#567843':'#788b57');
  for(let j=0;j<27 && bladeCount<14000;j++){
    const angle=j*2.39996+seeded()*.35,radius=seeded()*.09*tuftSize;
    dummy.position.set(x+Math.cos(angle)*radius,h+.005,z+Math.sin(angle)*radius);
    dummy.scale.set(tuftSize*(.7+seeded()*.6),tuftSize*(.65+seeded()*.6),tuftSize*(.7+seeded()*.6));
    dummy.rotation.set((seeded()-.5)*.25,angle,0);dummy.updateMatrix();
    grassInstances.setMatrixAt(bladeCount,dummy.matrix);grassInstances.setColorAt(bladeCount,tuftColor.clone().multiplyScalar(.8+seeded()*.35));bladeCount++;
  }
  if(i%4===0 && petalCount<790){
    for(let j=0;j<5;j++){
      const a=j*Math.PI*.4;dummy.position.set(x+Math.cos(a)*.06,h+.19,z+Math.sin(a)*.06);dummy.scale.set(1,.5,1);dummy.rotation.set(0,0,0);dummy.updateMatrix();
      petalInstances.setMatrixAt(petalCount,dummy.matrix);petalInstances.setColorAt(petalCount,new THREE.Color(i%3?'#fff4db':'#e7bd61'));petalCount++;
    }
  }
}
grassInstances.count=bladeCount;grassInstances.receiveShadow=true;world.add(grassInstances);
petalInstances.count=petalCount;world.add(petalInstances);
[[-5.9,-4.6,.65],[-4.9,-4.9,.85],[-.1,-3.6,.42],[.7,-2.5,.22],[-3.6,2.5,.32]].forEach(([x,z,s])=>{const r=stone(x,z,s);r.position.y=terrainHeight(x,z)+s*.28;});
for(let i=0;i<15;i++){
  const x=-2.6+seeded()*7,z=-4.1+seeded()*8.5;
  if(coastDistance(x,z)<-.6) continue;
  const shell=mesh(new THREE.SphereGeometry(.09,8,6),new THREE.MeshStandardMaterial({color:i%2?'#eacac0':'#f4eddc',roughness:.85}),new THREE.Vector3(x,terrainHeight(x,z)+.035,z),[1,.4,.8]);
  shell.rotation.y=seeded()*6;
}
const driftwood=mesh(new THREE.CylinderGeometry(.10,.14,1.4,7),mats.bark,new THREE.Vector3(.7,terrainHeight(.7,-.8)+.12,-.8));
driftwood.rotation.z=Math.PI/2;driftwood.rotation.y=.55;

const roundGeometry = new THREE.SphereGeometry(1, 24, 16);
function oval(parent, material, position, size) {
  return mesh(roundGeometry, material, new THREE.Vector3(...position), size, parent);
}
function limb(parent, material, start, end, radius) {
  const a = new THREE.Vector3(...start), b = new THREE.Vector3(...end);
  const part = mesh(new THREE.CylinderGeometry(radius * .7, radius, a.distanceTo(b), 8), material, a.clone().add(b).multiplyScalar(.5), 1, parent);
  part.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize());
  return part;
}
function makeDuck(name, path, color, phase) {
  const g = new THREE.Group(); g.scale.setScalar(.68); world.add(g);
  const feathers = new THREE.MeshStandardMaterial({color, roughness: .92});
  const wings = new THREE.MeshStandardMaterial({color: '#f0cc71', roughness: .95});
  const orange = new THREE.MeshStandardMaterial({color: '#e7a04c', roughness: .7});
  const dark = new THREE.MeshStandardMaterial({color: '#282b24', roughness: .28});
  const white = new THREE.MeshBasicMaterial({color: '#fff9e7'});
  const body = new THREE.Group(); g.add(body);
  const touchArea=new THREE.Mesh(roundGeometry,new THREE.MeshBasicMaterial({visible:false}));
  touchArea.position.set(.05,.60,0);touchArea.scale.set(.65,.6,.48);g.add(touchArea);
  // All parts share the +X forward axis; overlapping volumes keep the silhouette connected.
  oval(body, feathers, [-.07,.46,0], [.43,.33,.335]);
  oval(body, feathers, [.18,.61,0], [.22,.21,.235]);
  oval(body, feathers, [.28,.81,0], [.315,.3,.285]);
  oval(body, wings, [-.14,.48,-.302], [.23,.15,.06]).rotation.z = .18;
  oval(body, wings, [-.14,.48,.302], [.23,.15,.06]).rotation.z = .18;
  oval(body, feathers, [-.46,.52,0], [.16,.10,.13]).rotation.z = -.3;
  oval(body, orange, [.57,.745,0], [.16,.054,.13]);
  oval(body, orange, [.57,.718,0], [.145,.023,.115]);
  oval(body, feathers, [.16,1.08,0], [.09,.07,.08]).rotation.z = .4;
  for (const side of [-1,1]) {
    oval(body, dark, [.408,.862,side*.246], [.047,.052,.021]);
    oval(body, white, [.421,.881,side*.263], [.013,.014,.008]);
    oval(body, dark, [.589,.794,side*.043], [.012,.005,.007]);
  }
  const feet = [];
  for (const side of [-1,1]) {
    const foot = new THREE.Group(); foot.position.set(-.04,.21,side*.18); g.add(foot);
    limb(foot, orange, [0,0,0], [0,-.12,0], .034);
    const web = circleShape([[-.055,-.04],[.15,-.105],[.225,-.09],[.21,-.015],[.25,.035],[.2,.09],[.12,.09],[-.055,.04]]);
    const geo = new THREE.ExtrudeGeometry(web,{depth:.018,bevelEnabled:true,bevelSize:.012,bevelThickness:.009,bevelSegments:2});
    geo.rotateX(-Math.PI/2);
    mesh(geo,orange,new THREE.Vector3(0,-.145,0),1,foot);
    feet.push(foot);
  }
  const curve = new THREE.CatmullRomCurve3(path,true,'centripetal');
  g.userData = {name, curve, phase, body, feet, story:['小鸭子','扁扁的嘴，宽宽的蹼足，沿着草地慢慢散步。']};
  interactive.push(g); ducks.push(g);
}
makeDuck('麦芽',[new THREE.Vector3(-4.6,0,2.5),new THREE.Vector3(-3.5,0,1.6),new THREE.Vector3(-2.5,0,.5),new THREE.Vector3(-3.6,0,.2)],'#f6d87a',0);
makeDuck('小米',[new THREE.Vector3(-1.6,0,-2.6),new THREE.Vector3(-.6,0,-3.8),new THREE.Vector3(-2.6,0,-3.2),new THREE.Vector3(-2.1,0,-1.5)],'#ffe7a1',.3);

function crab(x,z,phase) {
  const g = new THREE.Group(); g.scale.setScalar(.7); g.position.set(x,.05,z); world.add(g);
  const shell = new THREE.MeshStandardMaterial({color:'#94715a',roughness:.85});
  const legsMat = new THREE.MeshStandardMaterial({color:'#b18561',roughness:.85});
  const eyes = new THREE.MeshStandardMaterial({color:'#252925',roughness:.3});
  oval(g,shell,[0,.24,0],[.3,.135,.225]);
  oval(g,legsMat,[0,.18,.02],[.25,.075,.18]);
  const legs = [];
  for (const side of [-1,1]) {
    for(let i=0;i<4;i++) {
      const leg = new THREE.Group(); leg.position.set(side*.23,.22,(i-1.5)*.1); g.add(leg);
      const spread=(i-1.5)*.12;
      limb(leg,legsMat,[0,0,0],[side*.22,-.01,spread],.03);
      limb(leg,legsMat,[side*.22,-.01,spread],[side*.34,-.19,spread*1.6],.024);
      legs.push(leg);
    }
    limb(g,legsMat,[side*.2,.23,.11],[side*.4,.22,.36],.055);
    limb(g,legsMat,[side*.4,.22,.36],[side*.3,.32,.48],.046);
    oval(g,shell,[side*.29,.34,.51],[.105,.07,.12]);
    limb(g,legsMat,[side*.23,.34,.55],[side*.22,.34,.69],.035);
    limb(g,legsMat,[side*.35,.34,.55],[side*.32,.34,.68],.035);
    limb(g,legsMat,[side*.12,.3,.13],[side*.14,.4,.23],.027);
    oval(g,eyes,[side*.14,.41,.24],[.038,.041,.037]);
  }
  g.userData={base:new THREE.Vector3(x,.05,z),phase,legs,story:['池边的小蟹','八条步足轮流迈动，两只螯轻轻举起。']};
  interactive.push(g); creatures.push(g);
}
crab(-1.7,3.5,0); crab(1.7,-2.7,2);

function updateSoundIcon(){
  const label=soundOn?'关闭声音':'开启声音';
  soundButton.setAttribute('aria-pressed',String(soundOn));soundButton.setAttribute('aria-label',label);
  soundButton.querySelector('img').src=`https://cdn.jsdelivr.net/npm/lucide-static@0.468.0/icons/${soundOn?'volume-2':'volume-x'}.svg`;
  soundButton.querySelector('.tooltip').textContent=label;
}
soundButton.addEventListener('click',e=>{e.stopPropagation();soundscape.setEnabled(!soundscape.enabled);});
document.querySelector('#experience').addEventListener('pointerdown',event=>{
  if(!soundscape.started && !event.target.closest('#sound-toggle'))soundscape.setEnabled(true);
});

function showStory(data) { activeStory=true; cardTitle.textContent=data[0]; cardCopy.textContent=data[1]; card.classList.add('show'); hint.textContent='水边的日子，慢慢悠悠。'; }
document.querySelector('#close-card').addEventListener('click',()=>{card.classList.remove('show');activeStory=false;hint.textContent='林间有风，岸边有潮。';});

function eventPoint(event) { const rect=renderer.domElement.getBoundingClientRect(); const touch=event.touches?.[0] || event.changedTouches?.[0] || event; pointer.x=((touch.clientX-rect.left)/rect.width)*2-1; pointer.y=-((touch.clientY-rect.top)/rect.height)*2+1; return touch; }
function pick(event) {
  eventPoint(event);raycaster.setFromCamera(pointer,camera);
  const hits=raycaster.intersectObjects(interactive,true).filter(hit=>hit.object!==pond.surface || pond.isWater(hit.point));
  if(!hits.length)return;
  const hit=hits.find(h=>h.object!==pond.surface && h.distance<hits[0].distance+.6) || hits[0];
  let target=hit.object;
  while(target.parent && !interactive.includes(target))target=target.parent;
  lens.focusAt(hit.point);
  const isDuck=ducks.includes(target);
  if(target===pond.surface){pond.ripple(hit.point,clock.getElapsedTime());soundscape.drop();}
  else if(isDuck)soundscape.quack();
  document.querySelector('#audio-credit').hidden=!isDuck;
  showStory(target.userData.story || hit.object.userData.story);
}
const pressedPointers = new Set();
let gesture = null;
renderer.domElement.addEventListener('pointerdown',event=>{
  pressedPointers.add(event.pointerId);
  if(pressedPointers.size === 1) gesture = {id:event.pointerId,x:event.clientX,y:event.clientY,moved:false};
  else if(gesture) gesture.moved = true;
});
renderer.domElement.addEventListener('pointermove',event=>{
  if(gesture && Math.hypot(event.clientX-gesture.x,event.clientY-gesture.y)>6) gesture.moved=true;
});
renderer.domElement.addEventListener('pointerup',event=>{
  if(gesture && gesture.id===event.pointerId && !gesture.moved && event.button===0) pick(event);
  pressedPointers.delete(event.pointerId);
  if(!pressedPointers.size) gesture=null;
});
renderer.domElement.addEventListener('pointercancel',event=>{pressedPointers.delete(event.pointerId);gesture=null;});
controls.addEventListener('start',()=>{card.classList.remove('show');activeStory=false;});

const toolButtons=[...document.querySelectorAll('.nature-tools button')];
function closeTools(){toolButtons.forEach(button=>{button.setAttribute('aria-expanded','false');document.getElementById(button.getAttribute('aria-controls')).hidden=true;});}
toolButtons.forEach(button=>button.addEventListener('click',()=>{
  const open=button.getAttribute('aria-expanded')!=='true';closeTools();
  card.classList.remove('show');activeStory=false;
  button.setAttribute('aria-expanded',String(open));document.getElementById(button.getAttribute('aria-controls')).hidden=!open;
}));
renderer.domElement.addEventListener('pointerdown',closeTools);
document.addEventListener('keydown',event=>{if(event.key==='Escape'){const active=toolButtons.find(b=>b.getAttribute('aria-expanded')==='true');closeTools();active?.focus();}});

const trail=document.querySelector('#cursor-trail'); let trailX=-100,trailY=-100; addEventListener('pointermove',e=>{trailX+=(e.clientX-trailX)*.22;trailY+=(e.clientY-trailY)*.22;trail.style.transform=`translate(${trailX}px,${trailY}px)`;});
function resize(){ const aspect=innerWidth/innerHeight; const view=Math.max(8.3,9.3/aspect); camera.left=-view*aspect;camera.right=view*aspect;camera.top=view;camera.bottom=-view;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);pond.resize();lens.resize(); } addEventListener('resize',resize); resize();
const levelInput=document.querySelector('#water-level');
const levelOutput=document.querySelector('#water-value');
const tideToggle=document.querySelector('#auto-tide');
const windInput=document.querySelector('#wind-strength');
const tideStatus=document.querySelector('#tide-status');
const toLevel=value=>MIN_LEVEL+(MAX_LEVEL-MIN_LEVEL)*Number(value)/100;
let tideOrigin=0;
levelInput.addEventListener('input',()=>{
  tideToggle.checked=false;pond.setLevel(toLevel(levelInput.value));
});
windInput.addEventListener('input',()=>{const value=Number(windInput.value)/100;pond.setWind(value*1.6);grassWind.value=value;document.querySelector('#wind-value').value=windInput.value+'%';});
tideToggle.addEventListener('change',()=>{
  const normalized=(pond.level-MIN_LEVEL)/(MAX_LEVEL-MIN_LEVEL);
  tideOrigin=clock.getElapsedTime()-Math.acos(THREE.MathUtils.clamp(1-2*normalized,-1,1))/.16;
  if(!tideToggle.checked) pond.setLevel(pond.level);
});
function animate(){
  requestAnimationFrame(animate);
  const t=clock.getElapsedTime();
  grassTime.value=t;
  if(location.search.includes('water-check'))renderer.domElement.dataset.audioCheck=JSON.stringify(soundscape.diagnostics());
  controls.update();
  if(tideToggle.checked){const percentage=(.5-.5*Math.cos((t-tideOrigin)*.16))*100;levelInput.value=percentage;pond.setLevel(toLevel(percentage));}
  const actualPercent=Math.round((pond.level-MIN_LEVEL)/(MAX_LEVEL-MIN_LEVEL)*100);
  levelOutput.value=actualPercent+'%';
  tideStatus.textContent=actualPercent<32?'退潮 · 沙滩露出':actualPercent>72?'涨潮 · 浅滩入海':'平潮 · 水光轻晃';

  ducks.forEach(d=>{
    const {curve,phase,body,feet}=d.userData;
    const progress=(t*.017+phase)%1;
    d.position.copy(curve.getPointAt(progress)); d.position.y=terrainHeight(d.position.x,d.position.z)+.006;
    const tangent=curve.getTangentAt(progress);
    d.rotation.y=Math.atan2(-tangent.z,tangent.x);
    body.rotation.x=Math.sin(t*5+phase*10)*.035;
    body.position.y=Math.abs(Math.sin(t*5+phase*10))*.014;
    feet.forEach((foot,i)=>{const stride=Math.sin(t*5+phase*10+i*Math.PI);foot.position.x=-.04+stride*.075;foot.position.y=.21+Math.max(0,stride)*.055;});
  });
  creatures.forEach(c=>{
    const q=c.userData;
    const retreat=Math.max(0,pond.level-terrainHeight(q.base.x,q.base.z)+.05)/.28;
    c.position.x=q.base.x-retreat+Math.sin(t*.35+q.phase)*.23;
    c.position.y=terrainHeight(c.position.x,c.position.z)+.025;
    q.legs.forEach((leg,i)=>{leg.rotation.z=Math.sin(t*6+i*Math.PI*.7+q.phase)*.09;leg.rotation.y=Math.sin(t*6+i*Math.PI*.7)*.08;});
  });
  pond.render(t);
  if(location.search.includes('water-check')){
    renderer.domElement.dataset.duckTargets=JSON.stringify(ducks.map(duck=>{
      const screen=duck.localToWorld(new THREE.Vector3(.05,.6,0)).project(camera);
      return {name:duck.userData.name,x:(screen.x*.5+.5)*innerWidth,y:(.5-screen.y*.5)*innerHeight};
    }));
  }
}
animate();
setTimeout(()=>loading.classList.add('done'),650);
