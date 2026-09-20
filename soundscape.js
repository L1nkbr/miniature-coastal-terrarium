export function createSoundscape(onChange) {
  let context,master,music,effects,analyser,timer,nextBeat=0,beat=0,enabled=false,started=false;
  const voices=new Set();
  const counts={notes:0,drops:0,quacks:0};
  let duckBuffer,duckLoad,duckError=null;
  const duckBytes=fetch(new URL('./mallard-quack.ogg',import.meta.url)).then(response=>{
    if(!response.ok)throw new Error('Duck recording unavailable');return response.arrayBuffer();
  }).catch(error=>{duckError=error.message;return null;});
  function loadDuck(){
    if(duckLoad)return duckLoad;
    duckLoad=duckBytes.then(async bytes=>{
      if(!bytes)return;
      const original=await context.decodeAudioData(bytes);
      const samples=original.getChannelData(0),step=Math.round(original.sampleRate*.01),energy=[];
      for(let i=0;i<samples.length;i+=step){let sum=0;for(let j=i;j<Math.min(i+step,samples.length);j++)sum+=samples[j]*samples[j];energy.push(Math.sqrt(sum/step));}
      const peak=Math.max(...energy),center=energy.indexOf(peak);
      let start=center,end=center;
      while(start>0 && energy[start-1]>peak*.12 && center-start<30)start--;
      while(end<energy.length-1 && energy[end+1]>peak*.12 && end-center<40)end++;
      const from=Math.max(0,(start-2)*step),to=Math.min(samples.length,(end+4)*step);
      duckBuffer=context.createBuffer(original.numberOfChannels,to-from,original.sampleRate);
      let amplitude=0;
      for(let c=0;c<original.numberOfChannels;c++){
        const source=original.getChannelData(c),out=duckBuffer.getChannelData(c);
        for(let i=0;i<out.length;i++){out[i]=source[from+i];amplitude=Math.max(amplitude,Math.abs(out[i]));}
      }
      const fade=Math.round(original.sampleRate*.012),scale=.8/Math.max(.1,amplitude);
      for(let c=0;c<duckBuffer.numberOfChannels;c++){
        const out=duckBuffer.getChannelData(c);
        for(let i=0;i<out.length;i++)out[i]*=scale*Math.min(1,i/fade,(out.length-1-i)/fade);
      }
    }).catch(error=>{duckError=error.message;});
    return duckLoad;
  }
  const chords=[[48,55,60,64,67],[45,52,57,60,64],[41,48,53,57,60],[43,50,55,59,62]];
  const melody=[72,null,76,79,null,76,74,null,72,null,69,72,null,76,72,null,69,null,72,76,null,72,69,null,67,null,71,74,null,71,67,null];
  const hz=n=>440*2**((n-69)/12);
  function cleanup(source,nodes){source.onended=()=>{source.disconnect();nodes.forEach(n=>n.disconnect());voices.delete(source);};voices.add(source);}
  function note(midi,at,duration,volume){
    const oscillator=context.createOscillator(),gain=context.createGain();
    oscillator.type='sine';oscillator.frequency.value=hz(midi);
    gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(volume,at+.035);
    gain.gain.exponentialRampToValueAtTime(.0001,at+duration);
    oscillator.connect(gain).connect(music);cleanup(oscillator,[gain]);
    oscillator.start(at);oscillator.stop(at+duration+.03);counts.notes++;
  }
  function schedule(){
    if(!enabled || context.state!=='running') return;
    if(nextBeat<context.currentTime-.2) nextBeat=context.currentTime+.05;
    while(nextBeat<context.currentTime+.25){
      const chord=chords[Math.floor(beat/8)%4];
      if(beat%8===0)chord.slice(0,4).forEach((n,i)=>note(n,nextBeat+i*.045,4.8,.028));
      if(beat%2===0)note(chord[(beat/2)%chord.length]+12,nextBeat,2.1,.033);
      const pitch=melody[beat%melody.length];
      if(pitch!==null)note(pitch,nextBeat+.025,2.5,.048);
      beat++;nextBeat+=.68;
    }
  }
  function init(){
    if(context)return;
    context=new AudioContext();master=context.createGain();master.gain.value=0;
    loadDuck();
    music=context.createGain();music.gain.value=.72;effects=context.createGain();effects.gain.value=.65;
    const compressor=context.createDynamicsCompressor();compressor.threshold.value=-16;compressor.ratio.value=3;
    const reverb=context.createConvolver(),impulse=context.createBuffer(2,context.sampleRate*1.8,context.sampleRate);
    for(let c=0;c<2;c++){const data=impulse.getChannelData(c);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.exp(-i/(context.sampleRate*.32))*.22;}
    reverb.buffer=impulse;
    const wet=context.createGain();wet.gain.value=.16;
    music.connect(master);music.connect(reverb);effects.connect(master);reverb.connect(wet).connect(master);
    analyser=context.createAnalyser();analyser.fftSize=256;
    master.connect(compressor).connect(analyser).connect(context.destination);
    timer=setInterval(schedule,100);
  }
  async function setEnabled(value){
    started=true;init();enabled=value;onChange(enabled);
    if(value){
      try{await context.resume();}catch{enabled=false;onChange(false);return;}
      if(context.state!=='running'){enabled=false;onChange(false);return;}
      if(!enabled)return;
      nextBeat=context.currentTime+.06;schedule();
    }
    master.gain.cancelScheduledValues(context.currentTime);
    master.gain.setTargetAtTime(enabled?.7:0,context.currentTime,.09);
  }
  function drop(){
    if(!enabled || context?.state!=='running' || voices.size>48)return;
    const t=context.currentTime,osc=context.createOscillator(),gain=context.createGain();
    osc.type='sine';osc.frequency.setValueAtTime(1100,t);osc.frequency.exponentialRampToValueAtTime(420,t+.045);osc.frequency.exponentialRampToValueAtTime(690,t+.16);
    gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(.19,t+.009);gain.gain.exponentialRampToValueAtTime(.0001,t+.32);
    osc.connect(gain).connect(effects);cleanup(osc,[gain]);osc.start(t);osc.stop(t+.34);counts.drops++;
  }
  let lastQuack=-1;
  async function quack(){
    if(!enabled || !context)return;
    const requested=performance.now();await loadDuck();
    if(!enabled || !duckBuffer || context.state!=='running' || performance.now()-requested>1500 || context.currentTime-lastQuack<duckBuffer.duration+.06 || voices.size>48)return;
    const t=context.currentTime;lastQuack=t;
    const source=context.createBufferSource(),gain=context.createGain();
    source.buffer=duckBuffer;gain.gain.value=.6;
    source.connect(gain).connect(effects);cleanup(source,[gain]);source.start(t);counts.quacks++;
  }
  document.addEventListener('visibilitychange',()=>{
    if(!context)return;
    if(document.hidden)context.suspend();
    else if(enabled)context.resume().then(()=>{nextBeat=context.currentTime+.06;schedule();}).catch(()=>{});
  });
  window.addEventListener('pagehide',()=>{clearInterval(timer);context?.close();});
  function diagnostics(){
    let rms=0;if(analyser){const data=new Float32Array(256);analyser.getFloatTimeDomainData(data);rms=Math.sqrt(data.reduce((sum,x)=>sum+x*x,0)/data.length);}
    return {enabled,state:context?.state || 'uninitialized',rms,voices:voices.size,duckLoaded:!!duckBuffer,duckDuration:duckBuffer?.duration,duckError,...counts};
  }
  return {setEnabled,drop,quack,diagnostics,get enabled(){return enabled;},get started(){return started;}};
}
