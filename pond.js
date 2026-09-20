import * as THREE from 'three';
import { createWaterMotion } from './water-motion.js';
import { DEFAULT_LEVEL, MIN_LEVEL, MAX_LEVEL, terrainHeight, terrainGLSL, coastGeometry, createGround, perimeter } from './terrain.js';

const waves = `
  uniform float uTime;
  uniform float uWind;
  uniform float uLevel;
  uniform float uSurge;
  uniform vec4 uObstacles[4];
  uniform vec4 uRipples[6];
  uniform sampler2D uFlow;
  vec4 flowAt(vec2 p){return texture2D(uFlow,clamp((p+vec2(7.,5.8))/vec2(14.,11.6),vec2(0.),vec2(1.)));}
  float wave(vec2 p) {
    float h = sin(p.x * 3.0 + p.y * 1.4 - uTime * 1.35) * .038;
    h += sin(p.y * 4.1 - p.x * 1.7 + uTime * 1.1) * .024;
    h += sin(p.x * 7.3 + p.y * 5.2 - uTime * 1.8) * .007;
    h *= uWind;
    float depth=max(0.,uLevel-terrainHeight(p));
    float incoming=dot(p,vec2(.83,.56))*3.8+uTime*1.9;
    float shore=exp(-depth*1.7)*smoothstep(0.,.14,depth);
    h+=sin(incoming)*(.025*uWind+.045*uSurge);
    h+=sin(incoming-depth*20.-uTime*.3)*shore*(.02*uWind+.035*uSurge);
    for(int i=0;i<4;i++) {
      vec4 rock=uObstacles[i];
      float distance=max(0.,length(p-rock.xy)-rock.z);
      float contact=smoothstep(.01,.12,uLevel-terrainHeight(rock.xy))*(1.-smoothstep(rock.w-.04,rock.w+.18,uLevel));
      float spread=exp(-distance*2.4)*smoothstep(0.,.08,distance);
      h+=sin(distance*13.-uTime*2.6+float(i)*1.7)*spread*contact*(.025*uWind+.045*uSurge);
    }
    for (int i = 0; i < 6; i++) {
      float age = uTime - uRipples[i].z;
      float dist = length(p - uRipples[i].xy);
      float band = dist - age * 1.25;
      float alive = step(0., age) * (1. - smoothstep(3., 5., age));
      h += sin(band * 15.) * exp(-band * band * 2.8) * .055 * alive;
    }
    vec4 flow=flowAt(p);
    return h*.65+flow.r+flow.g;
  }
`;

export function createPond(world, renderer, scene, camera, renderFinal) {
  const time = {value: 0};
  const level = {value: DEFAULT_LEVEL};
  let targetLevel=DEFAULT_LEVEL, previousTime=0;
  const wind={value:.75};
  const surge={value:0};
  const obstacleData = [[2.7,1.0,.26,.86],[4.3,-1.0,.22,.76],[0,3.8,.24,.60],[1.4,.4,.19,.53]];
  const obstacles={value:obstacleData.map(([x,z,r,h])=>new THREE.Vector4(x,z,r,terrainHeight(x,z)+h))};
  const motion=createWaterMotion(obstacleData);
  const bottles=[];
  const glass=new THREE.MeshPhysicalMaterial({color:'#86bfa5',transparent:true,opacity:.57,roughness:.16,metalness:.04,side:THREE.DoubleSide,depthWrite:false});
  const cork=new THREE.MeshStandardMaterial({color:'#a98452',roughness:1});
  const paper=new THREE.MeshStandardMaterial({color:'#f5e7c6',roughness:.85});
  for(let i=0;i<2;i++){
    const group=new THREE.Group(),bottle=new THREE.Group();group.add(bottle);world.add(group);
    const profile=[[0,-.32],[.105,-.32],[.13,-.27],[.13,.15],[.115,.21],[.06,.28],[.052,.4],[0,.4]].map(([r,y])=>new THREE.Vector2(r,y));
    bottle.add(new THREE.Mesh(new THREE.LatheGeometry(profile,20),glass));
    const stopper=new THREE.Mesh(new THREE.CylinderGeometry(.049,.048,.10,12),cork);stopper.position.y=.4;bottle.add(stopper);
    const note=new THREE.Mesh(new THREE.CylinderGeometry(.054,.054,.34,12),paper);note.position.y=-.06;bottle.add(note);
    bottle.rotation.z=Math.PI*.43;
    const hitArea=new THREE.Mesh(new THREE.SphereGeometry(1,12,8),new THREE.MeshBasicMaterial({visible:false}));
    hitArea.scale.set(.46,.24,.24);group.add(hitArea);
    group.userData.story=['漂流瓶',i?'愿每一道浪，都带来一个好消息。':'今天的风很轻，适合慢慢走。'];
    bottles.push(group);
  }
  const rippleUniform = {value: Array.from({length: 6}, () => new THREE.Vector4(0, 0, -100, 0))};
  let rippleIndex = 0;
  const bottomMat = new THREE.MeshStandardMaterial({color: '#d9ddd1', roughness: .95, vertexColors: true});
  bottomMat.onBeforeCompile = shader => {
    shader.uniforms.uTime = time;
    shader.uniforms.uLevel = level;
    shader.vertexShader = 'varying vec3 vPondPosition;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvPondPosition = position;');
    shader.fragmentShader = `uniform float uTime,uLevel;
      varying vec3 vPondPosition;
      vec2 cellHash(vec2 p) { return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453); }
      float caustic(vec2 p) {
        vec2 cell=floor(p), f=fract(p);
        float first=9.,second=9.;
        for(int x=-1;x<=1;x++) for(int y=-1;y<=1;y++) {
          vec2 offset=vec2(float(x),float(y));
          vec2 seed=cellHash(cell+offset);
          vec2 d=offset+.5+.33*sin(uTime*.65+6.2831*seed)-f;
          float distance=dot(d,d);
          if(distance<first){second=first;first=distance;} else second=min(second,distance);
        }
        return 1.-smoothstep(.015,.095,second-first);
      }
    ` + shader.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      float submerged = 1.-smoothstep(uLevel-.12,uLevel+.015,vPondPosition.y);
      float wet=1.-smoothstep(uLevel+.02,uLevel+.19,vPondPosition.y);
      diffuseColor.rgb*=mix(vec3(1.),vec3(.7,.8,.78),wet*.35);
      float sandGrain=fract(sin(dot(vPondPosition.xz,vec2(123.4,789.2)))*45758.5);
      diffuseColor.rgb*=.98+.04*sandGrain;
      vec2 cp=vPondPosition.xz*3.1;
      cp += .25*vec2(sin(cp.y*1.6+uTime*.4),cos(cp.x*1.1-uTime*.35));
      float lightWeb = caustic(cp);
      float lightPatch = .25+.75*smoothstep(-.45,.7,sin(cp.x*.7+uTime*.3)*cos(cp.y*.9-uTime*.2));
      totalEmissiveRadiance += vec3(.085,.16,.14)*lightWeb*lightPatch*submerged;
    `);
  };
  createGround(world,bottomMat);
  const pebbles = new THREE.Group(); world.add(pebbles);
  const rockMat = new THREE.MeshStandardMaterial({color:'#b8b7a2',roughness:.95});
  const rockGeo = new THREE.IcosahedronGeometry(1,1);
  obstacleData.forEach(([x,z,r,h],i)=>{
    const stone=new THREE.Mesh(rockGeo,rockMat);
    stone.position.set(x,terrainHeight(x,z)+h*.44,z);
    stone.scale.set(r,h*.57,r*.9);stone.rotation.y=i*.9;
    stone.castShadow=true;stone.receiveShadow=true;pebbles.add(stone);
  });
  for (let i=0;i<48;i++) {
    const x=-.8+(i*1.618%6.9),z=-4.9+(i*2.399%10.0);
    const stone=new THREE.Mesh(rockGeo,rockMat);
    stone.position.set(x,terrainHeight(x,z)+.05,z);
    const s=.045+(i%5)*.028;
    stone.scale.set(s*1.5,s*.65,s);
    stone.rotation.set(i*.34,i*.67,i*.16);
    stone.castShadow=true;stone.receiveShadow=true;pebbles.add(stone);
  }
  const grassMat=new THREE.MeshStandardMaterial({color:'#467c65',side:THREE.DoubleSide,roughness:1});
  for(let i=0;i<28;i++) {
    const x=2.6+(i*1.618%3.5),z=1.3+(i*2.4%3.9);
    const base=terrainHeight(x,z);
    for(let j=0;j<3;j++) {
      const h=.15+j*.08;
      const geo=new THREE.BufferGeometry();
      geo.setAttribute('position',new THREE.Float32BufferAttribute([-.035,0,0,.035,0,0,.07,h*.6,.02,.035,0,0,.13,h,.03,.07,h*.6,.02],3));
      geo.computeVertexNormals();
      const blade=new THREE.Mesh(geo,grassMat);blade.position.set(x,base,z);blade.rotation.y=j*2.1+i;pebbles.add(blade);
    }
  }

  const fish = [];
  const fishGeometry = new THREE.SphereGeometry(1,16,10);
  const fishEye = new THREE.MeshStandardMaterial({color:'#243f3a',roughness:.5});
  for(let i=0;i<4;i++) {
    const group = new THREE.Group();world.add(group);
    const material = new THREE.MeshStandardMaterial({color:i%2?'#c0b873':'#d1a16f',roughness:.6});
    const body = new THREE.Mesh(fishGeometry,material);body.scale.set(.28,.1,.115);group.add(body);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(.13,.2,3),material);
    tail.position.x=-.31;tail.rotation.z=-Math.PI/2;tail.scale.y=1;tail.scale.z=.35;group.add(tail);
    for(const side of [-1,1]) {
      const eye=new THREE.Mesh(fishGeometry,fishEye);eye.position.set(.18,.038,side*.085);eye.scale.setScalar(.022);group.add(eye);
      const fin=new THREE.Mesh(new THREE.ConeGeometry(.07,.17,3),material);fin.position.set(-.035,-.035,side*.14);fin.rotation.x=side*.8;fin.rotation.z=.7;fin.scale.z=.2;group.add(fin);
    }
    fish.push({group,tail,phase:i*1.57,radius:.65+i*.19});
  }

  const refraction = new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType});
  refraction.depthTexture = new THREE.DepthTexture(1,1);
  const reflection = new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType});
  const mirrorCamera = camera.clone();
  const textureMatrix = new THREE.Matrix4();
  const bias = new THREE.Matrix4().set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1);
  const clip = [new THREE.Plane(new THREE.Vector3(0,1,0),-DEFAULT_LEVEL)];
  const viewDirection = new THREE.Vector3();
  const look = new THREE.Vector3();
  const verifyPixels = new URLSearchParams(location.search).has('water-check');
  const pixelReports = [];
  let lastPixelCheck = -1;
  const uniforms = {
    uTime:time,uRipples:rippleUniform,uLevel:level,uWind:wind,uSurge:surge,uObstacles:obstacles,uFlow:{value:motion.texture},
    uScene:{value:refraction.texture},uDepth:{value:refraction.depthTexture},
    uReflection:{value:reflection.texture},uMirrorMatrix:{value:textureMatrix},
    uResolution:{value:new THREE.Vector2()},uView:{value:new THREE.Vector3()},
    uSun:{value:new THREE.Vector3(-8,13,5).normalize()},
  };
  const material=new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `${terrainGLSL}
${waves}
      varying vec3 vWorld;
      void main(){
        vec3 p=position;
        float tide=flowAt(p.xz).r;
        float depth=max(0.,uLevel+tide-terrainHeight(p.xz));
        p.y=tide+(wave(p.xz)-tide)*smoothstep(0.,.20,depth);
        vWorld=(modelMatrix*vec4(p,1.)).xyz;
        gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);
      }`,
    fragmentShader: `${terrainGLSL}
${waves}
      uniform sampler2D uScene,uDepth,uReflection;
      uniform mat4 uMirrorMatrix;
      uniform vec2 uResolution;
      uniform vec3 uView,uSun;
      varying vec3 vWorld;
      float surfaceDetail(vec2 p){
        return wave(p)+uWind*(sin(p.x*19.+p.y*11.-uTime*2.7)*.004
          +sin(p.y*23.-p.x*13.+uTime*2.1)*.003
          +sin(p.x*31.+sin(p.y*17.)-uTime*3.)*.0015);
      }
      void main(){
        vec2 p=vWorld.xz;
        float ground=terrainHeight(p);
        float depth=vWorld.y-ground;
        if(depth<.004) discard;
        float e=.025,edge=smoothstep(0.,.35,depth);
        vec3 n=normalize(vec3((surfaceDetail(p-vec2(e,0))-surfaceDetail(p+vec2(e,0)))/(2.*e)*edge,1.,(surfaceDetail(p-vec2(0,e))-surfaceDetail(p+vec2(0,e)))/(2.*e)*edge));
        vec2 screen=gl_FragCoord.xy/uResolution;
        vec2 offset=(mat3(viewMatrix)*n).xy*.022*min(depth,1.6);
        vec2 refracted=clamp(screen+offset,vec2(.001),vec2(.999));
        if(texture2D(uDepth,refracted).r<gl_FragCoord.z-.0001) refracted=screen;
        vec3 bedColor=texture2D(uScene,refracted).rgb;
        vec3 attenuation=exp(-vec3(2.5,1.12,.55)*depth);
        vec3 depthColor=mix(vec3(.014,.34,.37),vec3(.006,.075,.26),smoothstep(.12,1.75,depth));
        vec3 waterColor=bedColor*attenuation+depthColor*(1.-attenuation);
        vec4 mirror=uMirrorMatrix*vec4(vWorld,1.);
        vec2 mirrorUV=mirror.xy/mirror.w+n.xz*.025;
        vec3 reflected=texture2D(uReflection,clamp(mirrorUV,vec2(.001),vec2(.999))).rgb;
        float facing=clamp(dot(n,normalize(uView)),0.,1.);
        float fresnel=.035+.65*pow(1.-facing,3.);
        vec3 color=mix(waterColor,reflected,fresnel);
        color=mix(color,depthColor,smoothstep(.18,1.9,depth)*.28);
        vec3 halfVector=normalize(uSun+normalize(uView));
        float glint=pow(max(dot(n,halfVector),0.),95.);
        color+=vec3(1.,.96,.81)*glint*.4;
        float sheen=pow(max(dot(n,normalize(vec3(-.2,1.,.18))),0.),65.);
        color+=vec3(.045,.055,.055)*sheen*edge;
        float incoming=dot(p,vec2(.83,.56))*3.8+uTime*1.9;
        float wash=.06+.035*sin(incoming)+.06*uSurge;
        float edgeFoam=1.-smoothstep(.003,wash,depth);
        float breaker=pow(max(0.,sin(depth*18.+uTime*2.1+sin(p.y*3.+p.x)*.65)),12.);
        breaker*=exp(-depth*2.8)*(.23*uWind+.4*uSurge);
        float collisionFoam=0.;
        for(int i=0;i<4;i++) {
          vec4 rock=uObstacles[i];
          float distance=max(0.,length(p-rock.xy)-rock.z);
          float contact=smoothstep(.01,.12,uLevel-terrainHeight(rock.xy))*(1.-smoothstep(rock.w-.04,rock.w+.18,uLevel));
          float ring=pow(max(0.,cos(distance*15.-uTime*2.6+float(i)*1.7)),12.);
          float impact=clamp(flowAt(p).b*4.,0.,1.);
          collisionFoam+=ring*exp(-distance*3.2)*contact*(.15*uWind+.4*impact+.25*uSurge);
        }
        float grain=.55+.45*sin(p.x*53.+sin(p.y*29.))*sin(p.y*41.-uTime);
        float foam=(edgeFoam*.57+breaker+collisionFoam)*smoothstep(.15,.85,grain);
        color=mix(color,vec3(.85,.95,.94),clamp(foam,0.,.8));
        gl_FragColor=vec4(color,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const surface = new THREE.Mesh(coastGeometry(()=>0),material);
  surface.position.y=DEFAULT_LEVEL;
  surface.name='coastal-water';
  surface.userData.story=['潮水与浅滩','水位慢慢升高，沙滩上的石子又回到了水里。'];
  world.add(surface);
  // A transparent cut face closes the water along the miniature's outer edge.
  const boundary=perimeter(),sidePositions=[],sideIndices=[];
  boundary.forEach(([x,z],i)=>{
    sidePositions.push(x,DEFAULT_LEVEL,z,x,terrainHeight(x,z),z);
    const next=(i+1)%boundary.length;
    sideIndices.push(i*2,next*2,i*2+1,next*2,next*2+1,i*2+1);
  });
  const sideGeometry=new THREE.BufferGeometry();
  sideGeometry.setAttribute('position',new THREE.Float32BufferAttribute(sidePositions,3));
  sideGeometry.setIndex(sideIndices);sideGeometry.computeVertexNormals();
  const sideMaterial=new THREE.ShaderMaterial({
    uniforms:{uLevel:level,uFlow:{value:motion.texture}},
    vertexShader:`varying vec3 vWorld;void main(){vWorld=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`${terrainGLSL}
      uniform float uLevel;uniform sampler2D uFlow;varying vec3 vWorld;
      void main(){float local=uLevel+texture2D(uFlow,(vWorld.xz+vec2(7.,5.8))/vec2(14.,11.6)).r;if(vWorld.y>local || terrainHeight(vWorld.xz)>local) discard;float d=local-vWorld.y;gl_FragColor=vec4(mix(vec3(.055,.43,.49),vec3(.005,.075,.25),smoothstep(0.,1.8,d)),.78);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`,
    transparent:true,depthWrite:false,side:THREE.DoubleSide
  });
  const waterSides=new THREE.Mesh(sideGeometry,sideMaterial);world.add(waterSides);

  function resize() {
    const size=renderer.getDrawingBufferSize(new THREE.Vector2());
    uniforms.uResolution.value.copy(size);
    const ratio=Math.min(1,1400/Math.max(size.x,size.y));
    refraction.setSize(Math.round(size.x*ratio),Math.round(size.y*ratio));
    reflection.setSize(Math.round(size.x*ratio*.6),Math.round(size.y*ratio*.6));
  }
  function render(t) {
    const dt=Math.min(.05,t-previousTime);previousTime=t;
    const previousLevel=level.value;
    level.value=THREE.MathUtils.damp(level.value,targetLevel,3,dt);
    const rise=Math.max(0,(level.value-previousLevel)/Math.max(.001,dt));
    surge.value=THREE.MathUtils.damp(surge.value,Math.min(1,rise*10),2.5,dt);
    motion.update(dt,level.value,wind.value,surge.value);
    time.value=t;
    const border=sideGeometry.attributes.position;
    for(let i=0;i<boundary.length;i++) border.setY(i*2,motion.sample(...boundary[i]));
    border.needsUpdate=true;
    surface.position.y=level.value;
    clip[0].constant=-level.value;
    bottles.forEach((b,i)=>{
      const x=4.5+i*.8+Math.sin(t*.13+i*2)*.35,z=2.8-i*1.4+Math.cos(t*.11+i)*.28;
      const water=motion.sample(x,z),ground=terrainHeight(x,z);
      b.position.set(x,Math.max(ground+.14,water+.065),z);
      const floating=water>ground+.1;
      b.rotation.set(floating?(motion.sample(x,z+.16)-motion.sample(x,z-.16))*1.8:0,i*1.7+Math.sin(t*.12)*.16,floating?(motion.sample(x+.16,z)-motion.sample(x-.16,z))*-1.8:0);
    });
    fish.forEach(({group,tail,phase,radius})=>{
      const a=t*.18+phase;
      const x=5.05+Math.cos(a)*radius*.78,z=3.6+Math.sin(a)*radius*.57;
      const y=THREE.MathUtils.clamp(level.value-.4+Math.sin(a*1.6+phase)*.04,terrainHeight(x,z)+.14,level.value-.14);
      group.position.set(x,y,z);
      group.rotation.y=Math.atan2(-Math.cos(a)*.73,-Math.sin(a));
      tail.rotation.y=Math.sin(t*7+phase)*.3;
    });
    camera.updateMatrixWorld();
    camera.getWorldDirection(viewDirection);
    uniforms.uView.value.copy(viewDirection).negate();
    mirrorCamera.copy(camera);
    mirrorCamera.position.y=2*level.value-camera.position.y;
    look.copy(camera.position).add(viewDirection);look.y=2*level.value-look.y;
    mirrorCamera.up.set(0,-1,0);mirrorCamera.lookAt(look);mirrorCamera.updateMatrixWorld();
    textureMatrix.copy(bias).multiply(mirrorCamera.projectionMatrix).multiply(mirrorCamera.matrixWorldInverse);
    const oldTarget=renderer.getRenderTarget(), oldClip=renderer.clippingPlanes;
    const oldShadow=renderer.shadowMap.autoUpdate;
    surface.visible=false;waterSides.visible=false;
    renderer.setRenderTarget(refraction);renderer.render(scene,camera);
    renderer.shadowMap.autoUpdate=false;
    renderer.clippingPlanes=clip;
    renderer.setRenderTarget(reflection);renderer.render(scene,mirrorCamera);
    renderer.clippingPlanes=oldClip;
    surface.visible=true;waterSides.visible=true;
    renderer.setRenderTarget(oldTarget);
    if(renderFinal) renderFinal();else renderer.render(scene,camera);
    renderer.shadowMap.autoUpdate=oldShadow;
    // Opt-in browser verification samples the actual water framebuffer after rendering.
    if(verifyPixels && t-lastPixelCheck>1) {
      lastPixelCheck=t;
      const gl=renderer.getContext(),size=renderer.getDrawingBufferSize(new THREE.Vector2());
      const center=new THREE.Vector3(3.2,level.value,2.6).project(camera);
      const x=Math.max(0,Math.min(size.x-32,Math.round((center.x*.5+.5)*size.x)-16));
      const y=Math.max(0,Math.min(size.y-32,Math.round((center.y*.5+.5)*size.y)-16));
      const pixels=new Uint8Array(32*32*4);
      gl.readPixels(x,y,32,32,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
      let nonempty=0,hash=2166136261;
      const colors=new Set();
      for(let i=0;i<pixels.length;i+=4){
        if(pixels[i]+pixels[i+1]+pixels[i+2]>0) nonempty++;
        colors.add((pixels[i]<<16)|(pixels[i+1]<<8)|pixels[i+2]);
        hash=Math.imul(hash^pixels[i],16777619);hash=Math.imul(hash^pixels[i+1],16777619);hash=Math.imul(hash^pixels[i+2],16777619);
      }
      pixelReports.push({time:Math.round(t*100)/100,nonempty,colors:colors.size,hash:hash>>>0,error:gl.getError()});
      if(pixelReports.length>4) pixelReports.shift();
      renderer.domElement.dataset.waterCheck=JSON.stringify(pixelReports);
      renderer.domElement.dataset.motionCheck=JSON.stringify({deep:motion.sample(6,4),shore:motion.sample(1,1),level:level.value,bottles:bottles.map(b=>b.position.y)});
    }
  }
  function ripple(point,t) {
    motion.disturb(point.x,point.z);
    rippleUniform.value[rippleIndex].set(point.x,point.z,t,1);
    rippleIndex=(rippleIndex+1)%rippleUniform.value.length;
  }
  function setLevel(value){targetLevel=THREE.MathUtils.clamp(value,MIN_LEVEL,MAX_LEVEL);}
  function setWind(value){wind.value=THREE.MathUtils.clamp(value,0,1.6);}
  function isWater(point){return terrainHeight(point.x,point.z)<motion.sample(point.x,point.z)-.015;}
  return {surface,bottles,render,resize,ripple,setLevel,setWind,isWater,get level(){return level.value;}};

}
