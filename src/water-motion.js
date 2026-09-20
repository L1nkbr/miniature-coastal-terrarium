import * as THREE from 'three';
import {HALF_WIDTH,HALF_DEPTH,DEFAULT_LEVEL,terrainHeight} from './terrain.js';

// A damped height-field wave equation reflects at dry land and exposed rocks.
export function createWaterMotion(rocks){
  const nx=97,nz=81,count=nx*nz,dx=2*HALF_WIDTH/(nx-1),dz=2*HALF_DEPTH/(nz-1);
  let height=new Float32Array(count),previous=new Float32Array(count),next=new Float32Array(count);
  const bed=new Float32Array(count),wet=new Uint8Array(count),data=new Float32Array(count*4);
  const localLevel=new Float32Array(count),delay=new Float32Array(count),blocked=new Float32Array(count);
  const history=Array.from({length:256},()=>DEFAULT_LEVEL);
  let historyIndex=0,accumulator=0,simulationTime=0;
  for(let z=0;z<nz;z++)for(let x=0;x<nx;x++){
    const i=z*nx+x,wx=x*dx-HALF_WIDTH,wz=z*dz-HALF_DEPTH;
    bed[i]=terrainHeight(wx,wz);localLevel[i]=DEFAULT_LEVEL;
    delay[i]=Math.max(0,(8.1-wx*.83-wz*.56)/2.2);
    blocked[i]=-100;
    for(const [rx,rz,r,h] of rocks)if(Math.hypot(wx-rx,wz-rz)<r*.88)blocked[i]=terrainHeight(rx,rz)+h;
  }
  const texture=new THREE.DataTexture(data,nx,nz,THREE.RGBAFormat,THREE.FloatType);
  texture.minFilter=texture.magFilter=THREE.LinearFilter;
  texture.needsUpdate=true;
  function update(dt,level,wind,surge){
    accumulator+=Math.min(dt,.066);
    while(accumulator>=1/60){
      accumulator-=1/60;simulationTime+=1/60;
      historyIndex=(historyIndex+1)%history.length;history[historyIndex]=level;
      for(let i=0;i<count;i++){
        const frames=Math.min(254,delay[i]*60),whole=Math.floor(frames),fraction=frames-whole;
        const a=history[(historyIndex-whole+256)%256],b=history[(historyIndex-whole-1+256)%256];
        localLevel[i]=a+(b-a)*fraction;
        wet[i]=localLevel[i]>bed[i]+.015 && localLevel[i]>blocked[i] ? 1 : 0;
      }
      for(let z=0;z<nz;z++)for(let x=0;x<nx;x++){
        const i=z*nx+x;
        if(!wet[i]){next[i]=0;continue;}
        const center=height[i];
        const neighbor=j=>wet[j]?height[j]:center;
        const left=x?neighbor(i-1):center,right=x<nx-1?neighbor(i+1):center;
        const back=z?neighbor(i-nx):center,front=z<nz-1?neighbor(i+nx):center;
        const depth=Math.max(.04,localLevel[i]-bed[i]);
        const speed=Math.min(5,2+depth*2);
        const lap=(left+right-2*center)/(dx*dx)+(back+front-2*center)/(dz*dz);
        let value=(2*center-previous[i]+speed*lap/3600)*.996;
        if(x>nx-4 || z>nz-4){
          const phase=simulationTime*1.75+(x*dx*.15-z*dz*.19);
          const source=Math.sin(phase)*(.032*wind+.095*surge);
          value=value*.88+source*.12;
        }
        next[i]=THREE.MathUtils.clamp(value,-.22,.22);
      }
      const old=previous;previous=height;height=next;next=old;
    }
    for(let i=0;i<count;i++){
      data[i*4]=localLevel[i]-level;data[i*4+1]=height[i];
      data[i*4+2]=Math.abs(height[i]-previous[i])*60;data[i*4+3]=1;
    }
    texture.needsUpdate=true;
  }
  function sample(x,z){
    const gx=THREE.MathUtils.clamp((x+HALF_WIDTH)/dx,0,nx-1.001),gz=THREE.MathUtils.clamp((z+HALF_DEPTH)/dz,0,nz-1.001);
    const ix=Math.floor(gx),iz=Math.floor(gz),fx=gx-ix,fz=gz-iz,i=iz*nx+ix;
    const at=j=>localLevel[j]+height[j];
    return THREE.MathUtils.lerp(THREE.MathUtils.lerp(at(i),at(i+1),fx),THREE.MathUtils.lerp(at(i+nx),at(i+nx+1),fx),fz);
  }
  function disturb(x,z){
    for(let iz=0;iz<nz;iz++)for(let ix=0;ix<nx;ix++){
      const i=iz*nx+ix,d=Math.hypot(ix*dx-HALF_WIDTH-x,iz*dz-HALF_DEPTH-z);
      if(wet[i] && d<.5) height[i]+=.045*Math.exp(-d*d*24);
    }
  }
  return {texture,update,sample,disturb};
}
