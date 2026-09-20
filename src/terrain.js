import * as THREE from 'three';

export const HALF_WIDTH = 7;
export const HALF_DEPTH = 5.8;
export const DEFAULT_LEVEL = -.08;
export const MIN_LEVEL = -.72;
export const MAX_LEVEL = .42;

export function coastDistance(x,z) {
  return x*.76+z*.50+.50*Math.sin(z*.76)-.35*Math.cos(x*.68)-.25;
}
export function terrainHeight(x,z) {
  const hill=.20*Math.exp(-((x+4)*(x+4)+(z+3)*(z+3))*.16);
  return Math.min(.95,.44-.28*coastDistance(x,z)+hill);
}
// The water shader uses the same height field, so shorelines follow the actual ground.
export const terrainGLSL = `
  float terrainHeight(vec2 p) {
    float d=p.x*.76+p.y*.50+.50*sin(p.y*.76)-.35*cos(p.x*.68)-.25;
    float hill=.20*exp(-dot(p+vec2(4.,3.),p+vec2(4.,3.))*.16);
    return min(.95,.44-.28*d+hill);
  }
`;

function roundCorner(x,z) {
  const cx=Math.max(Math.abs(x)-(HALF_WIDTH-.85),0);
  const cz=Math.max(Math.abs(z)-(HALF_DEPTH-.85),0);
  const length=Math.hypot(cx,cz);
  if(length>.85) {
    x=Math.sign(x)*(HALF_WIDTH-.85+cx/length*.85);
    z=Math.sign(z)*(HALF_DEPTH-.85+cz/length*.85);
  }
  return [x,z];
}

export function coastGeometry(height,columns=120,rows=100) {
  const positions=[],uv=[],indices=[];
  for(let j=0;j<=rows;j++) for(let i=0;i<=columns;i++) {
    const [x,z]=roundCorner((i/columns*2-1)*HALF_WIDTH,(j/rows*2-1)*HALF_DEPTH);
    positions.push(x,height(x,z),z);uv.push(i/columns,j/rows);
    if(i&&j){const a=j*(columns+1)+i,b=a-columns-1;indices.push(a,b,a-1,b,b-1,a-1);}
  }
  const geo=new THREE.BufferGeometry();
  geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(indices);geo.computeVertexNormals();
  return geo;
}

export function perimeter() {
  const points=[];
  for(let side=0;side<4;side++) for(let i=0;i<80;i++) {
    const u=i/80;
    const edges=[[-HALF_WIDTH+2*HALF_WIDTH*u,-HALF_DEPTH],[HALF_WIDTH,-HALF_DEPTH+2*HALF_DEPTH*u],[HALF_WIDTH-2*HALF_WIDTH*u,HALF_DEPTH],[-HALF_WIDTH,HALF_DEPTH-2*HALF_DEPTH*u]];
    points.push(roundCorner(...edges[side]));
  }
  return points;
}

export function createGround(world,material) {
  const geo=coastGeometry(terrainHeight),p=geo.attributes.position,colors=[];
  for(let i=0;i<p.count;i++) {
    const x=p.getX(i),z=p.getZ(i),d=coastDistance(x,z);
    const mottling=.03*Math.sin(x*7+z*3)*Math.sin(z*9);
    const grass=new THREE.Color('#85ab69');
    const sand=new THREE.Color('#e7d9aa');
    const deep=new THREE.Color('#acc5b2');
    const color=grass.lerp(sand,THREE.MathUtils.smoothstep(d+mottling*7,-2.1,-.85));
    color.lerp(deep,THREE.MathUtils.smoothstep(d,3.5,8)*.55);
    color.multiplyScalar(1+mottling);colors.push(color.r,color.g,color.b);
  }
  geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  const ground=new THREE.Mesh(geo,material);ground.receiveShadow=true;world.add(ground);
  const boundary=perimeter(),positions=[],indices=[];
  boundary.forEach(([x,z],i)=>{
    positions.push(x,terrainHeight(x,z),z,x,-2.65,z);
    const next=(i+1)%boundary.length;
    indices.push(i*2,next*2,i*2+1,next*2,next*2+1,i*2+1);
  });
  const sides=new THREE.BufferGeometry();sides.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));sides.setIndex(indices);sides.computeVertexNormals();
  const sideMat=new THREE.MeshStandardMaterial({color:'#bbaa80',roughness:1,side:THREE.DoubleSide});
  const wall=new THREE.Mesh(sides,sideMat);wall.castShadow=true;wall.receiveShadow=true;world.add(wall);
  return ground;
}
