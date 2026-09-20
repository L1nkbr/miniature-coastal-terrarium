import * as THREE from 'three';

export function createMiniatureLens(renderer, camera, controls) {
  const target = new THREE.WebGLRenderTarget(1, 1, {type: THREE.HalfFloatType});
  target.depthTexture = new THREE.DepthTexture(1, 1);
  const uniforms = {
    image: {value: target.texture}, depthMap: {value: target.depthTexture},
    pixel: {value: new THREE.Vector2()}, focus: {value: 20},
    nearClip: {value: camera.near}, farClip: {value: camera.far}, strength: {value: 0},
  };
  const material = new THREE.ShaderMaterial({uniforms, depthTest: false, depthWrite: false,
    vertexShader: 'varying vec2 uvScreen; void main(){uvScreen=uv;gl_Position=vec4(position.xy,0.,1.);}',
    fragmentShader: `
      uniform sampler2D image,depthMap;
      uniform vec2 pixel;
      uniform float focus,nearClip,farClip,strength;
      varying vec2 uvScreen;
      float distanceAt(vec2 uv){return mix(nearClip,farClip,texture2D(depthMap,uv).r);}
      void main(){
        float depth=distanceAt(uvScreen);
        float radius=smoothstep(.65,5.,abs(depth-focus))*strength;
        vec3 color=texture2D(image,uvScreen).rgb;
        float weight=1.;
        for(int i=0;i<24;i++){
          float a=float(i)*2.399963;
          vec2 uv=clamp(uvScreen+vec2(cos(a),sin(a))*sqrt((float(i)+.5)/24.)*radius*pixel,vec2(.001),vec2(.999));
          float sampleDepth=distanceAt(uv);
          float w=1.-smoothstep(1.,4.,depth-sampleDepth);
          color+=texture2D(image,uv).rgb*w;weight+=w;
        }
        gl_FragColor=vec4(color/weight,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`});
  const screen = new THREE.Scene();
  screen.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),material));
  const screenCamera = new THREE.Camera();
  const direction = new THREE.Vector3(), delta = new THREE.Vector3();
  let selectedFocus=null;
  controls.addEventListener('start',()=>{selectedFocus=null;});
  function resize(){
    const size=renderer.getDrawingBufferSize(new THREE.Vector2());
    target.setSize(size.x,size.y);uniforms.pixel.value.set(1/size.x,1/size.y);
  }
  function render(scene){
    uniforms.strength.value=THREE.MathUtils.smoothstep(camera.zoom,1.25,2.8)*9*renderer.getPixelRatio();
    renderer.domElement.dataset.focusEffect=uniforms.strength.value.toFixed(2);
    if(uniforms.strength.value<.01){renderer.render(scene,camera);return;}
    camera.getWorldDirection(direction);
    uniforms.focus.value=delta.copy(selectedFocus || controls.target).sub(camera.position).dot(direction);
    renderer.setRenderTarget(target);renderer.render(scene,camera);
    renderer.setRenderTarget(null);renderer.render(screen,screenCamera);
  }
  resize();
  return {resize,render,focusAt(point){selectedFocus=point.clone();}};
}
