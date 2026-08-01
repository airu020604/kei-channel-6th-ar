// ===== 各種インポート =====
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { VRMLoaderPlugin } from "@pixiv/three-vrm";
import { MindARThree } from "mindar-image-three";

import {
  VRMAnimationLoaderPlugin,
  createVRMAnimationClip
} from "@pixiv/three-vrm-animation";


// ===== Three =====
let renderer;
let scene;
let camera;
let clock;

// ===== MindAR =====
let mindarThree;
let anchor = null;;

// ===== VRM =====
let vrm = null;
let modelRoot = null;
let rotateRoot = null;

// ===== Animation =====
let mixer = null;

// ===== 状態 =====
let isTracking = false;
let isFixed = false;

// ===== 操作 =====
let rotationX = 0;
let rotationY = 0;
let currentScale = 1;

// ===== UI =====
let mode = "photo";


let animationAction = null;
let idleBaseY = 0;
let modelScale = 0.8;
let appearProgress = 1;
let baseScale = 0.3;
let freezeSpringBone = false;
let isLocking = false;
let isAppearing = false;


let modelOffsetY = 0;

let isDragging = false;

let previousMouseX = 0;
let previousMouseY = 0;

let previousTouchX = 0;
let previousTouchY = 0;

let pinchDistance = 0;

let modelY = 0;



// ===== スタート関数 =====
async function start(){

    await init();

    await loadVRM();

    await new Promise(resolve=>{
    requestAnimationFrame(resolve);
    });

    modelRoot = new THREE.Group();

    rotateRoot = new THREE.Group();
    //rotateRoot.rotation.y = Math.PI;

    rotateRoot.add(vrm.scene);

    modelRoot.add(rotateRoot);

    anchor.group.add(modelRoot);

    vrm.scene.updateMatrixWorld(true);

    await loadVRMA();

    await startMindAR();

    setupInput();

    animate();

}



// ===== 〇〇〇 =====
async function init(){

    clock = new THREE.Clock();

    mindarThree = new MindARThree({

        container:document.querySelector("#container"),
        imageTargetSrc:"./targets/targets.mind"

    });

    renderer = mindarThree.renderer;
    scene = mindarThree.scene;
    camera = mindarThree.camera;

    anchor = mindarThree.addAnchor(0);


const ambientLight = new THREE.AmbientLight(
    0xffffff,
    2
);

scene.add(ambientLight);


const directionalLight = new THREE.DirectionalLight(
    0xffffff,
    3
);

directionalLight.position.set(
    1,
    1,
    1
);

scene.add(directionalLight);

}







// ===== VRM読み込み関数 Start =====
function loadVRM(anchor) {

  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.register(parser => new VRMLoaderPlugin(parser));
    loader.load("./models/kei.vrm",
    (gltf) => {
      vrm = gltf.userData.vrm;

      vrm.scene.updateMatrixWorld(true);

/*      
      if(vrm.springBoneManager){

        vrm.springBoneManager.reset();

      }
*/
/*
      if (vrm.lookAt) {
        vrm.lookAt.autoUpdate = false;
      }
*/

      vrm.scene.scale.set(1, 1, 1);
      vrm.scene.position.set(0, -0.5, 0);
      idleBaseY = -0.5;
      //vrm.scene.rotation.y = Math.PI;

      vrm.scene.traverse((obj) => {
        if (obj.material) {
          obj.material.needsUpdate = true;
        }
      });
vrm.scene.position.set(0, -0.5, 0);

modelRoot = new THREE.Group();

rotateRoot = new THREE.Group();
rotateRoot.position.set(
    0,
    -0.5,
    0
);

rotateRoot.rotation.y = Math.PI;



// VRMサイズ調整
modelRoot.scale.set(
    0.01,
    0.01,
    0.01
);


rotateRoot.add(vrm.scene);

vrm.scene.updateMatrixWorld(true);

modelRoot.add(rotateRoot);

modelRoot.updateMatrixWorld(true);

if(anchor){

  anchor.group.add(modelRoot);

  anchor.group.updateMatrixWorld(true);

}


  modelRoot.add(rotateRoot);

  scene.add(modelRoot);
modelRoot = new THREE.Group();

rotateRoot = new THREE.Group();

rotateRoot.add(vrm.scene);

modelRoot.add(rotateRoot);


modelRoot.position.set(0,0,-1);

scene.add(modelRoot);


modelRoot.position.y = -0.5;

        vrm.scene.visible = true;
        vrm.scene.position.set(0, -0.5, 0);
        vrm.scene.scale.set(1,1,1);
        resolve();
      },
      undefined,
      (error)=>{
        console.error("VRM LOAD ERROR", error);
        reject(error);
      }
    );
  });
  
}



// ===== ロードVRMA設定関数 Start =====
async function loadVRMA() {
  const loader = new GLTFLoader();

  loader.register((parser) => {
    return new VRMAnimationLoaderPlugin(parser);
  });

  const gltf = await loader.loadAsync("./motions/idle.vrma");
  const vrmAnimation = gltf.userData.vrmAnimations[0];
  vrm.scene.updateMatrixWorld(true);
  const clip = createVRMAnimationClip(vrmAnimation, vrm);

  mixer = new THREE.AnimationMixer(vrm.scene);
  animationAction = mixer.clipAction(clip);

  if(animationAction){
    vrm.humanoid?.resetNormalizedPose();
    //vrm.springBoneManager?.reset();
    vrm.update(0);

    await new Promise(resolve=>{
        requestAnimationFrame(resolve);
    });

    animationAction.stop();
    animationAction.reset();
    mixer.setTime(0);
    animationAction.play();
  }


  animationAction.setLoop(THREE.LoopOnce, 1);
  animationAction.clampWhenFinished = true;
  animationAction.enabled = true;
  animationAction.setLoop(
    THREE.LoopOnce,
    1
  );
  animationAction.play();
}
// ===== ロードVRMA設定関数 End =====



// ===== startMindAR =====
async function startMindAR(){

    await mindarThree.start();

    if(anchor && modelRoot){

        anchor.group.add(modelRoot);

    }


anchor.onTargetFound = ()=>{

    if(isTracking) return;

    isTracking = true;

    console.log("FOUND");

    freezeSpringBone = true;

    // 出現開始
    appearProgress = 0;
    isAppearing = true;

    setTimeout(()=>{

        isLocking = false;
        freezeSpringBone = true;
        fixModel();

    },1500);

};

anchor.onTargetLost = ()=>{

    console.log("LOST");

    // 固定前のロスト対策
    if(!isFixed){

        console.log("WAITING FIX");

        return;

    }

    if(isLocking){

        console.log("ignore lost during lock");

        return;

    }

};

}




function fixModel(){

    if(isFixed) return;


    const worldPos = new THREE.Vector3();
    const worldQuat = new THREE.Quaternion();
    const scale = new THREE.Vector3();

    modelRoot.getWorldPosition(worldPos);
    modelRoot.getWorldQuaternion(worldQuat);
    modelRoot.getWorldScale(scale);

    scene.add(modelRoot);


    modelRoot.position.copy(worldPos);
    modelRoot.quaternion.copy(worldQuat);
    modelRoot.scale.copy(scale);

    isFixed = true;


        // VRMのワールド行列更新
    vrm.scene.updateMatrixWorld(true);


    // SpringBone再初期化
    if(vrm.springBoneManager){

        vrm.springBoneManager.reset();

    }



    console.log("MODEL FIXED");

}



// ===== setupInput End =====
function setupInput() {
  const container = document.querySelector("#container");
  container.style.touchAction = "none";
  container.addEventListener("mousedown", (e) => {
    isDragging = true;
    previousMouseX = e.clientX;
    previousMouseY = e.clientY;
  });

  window.addEventListener("mouseup", () => {
    isDragging = false;
  });

  window.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    if (!rotateRoot) return;
    const dx = e.clientX - previousMouseX;
    const dy = e.clientY - previousMouseY;

    previousMouseX = e.clientX;
    previousMouseY = e.clientY;
    rotationY += dx * 0.01;
    rotationX += dy * 0.01;

console.log(
  "DRAG INPUT",
  rotationX,
  rotationY
);
    
    rotationX = Math.max(
      -0.8,
      Math.min(
        0.8,
        rotationX
      )
    );

    console.log("rotation", rotationY);
  });


  container.addEventListener("touchstart", (e) => {
    if (e.touches.length === 1){
      isDragging = true;
      previousTouchX = e.touches[0].clientX;
      previousTouchY = e.touches[0].clientY;
    }

    if (e.touches.length === 2){
      pinchDistance = getDistance(e.touches);
    }

    isDragging = true;
    previousTouchX = e.touches[0].clientX;
    previousTouchY = e.touches[0].clientY;
  },{ passive:false });


  container.addEventListener("touchmove", (e) => {
    if (e.touches.length === 2){
      const distance = getDistance(e.touches);
      const diff = distance - pinchDistance;
      pinchDistance = distance;
      currentScale += diff * 0.003;
      currentScale = Math.max(0.5,Math.min(3,currentScale));
      return;
    }
    e.preventDefault();
    if (!rotateRoot) return;
    //if (!isDragging) return;

    const dx = e.touches[0].clientX - previousTouchX;
    const dy = e.touches[0].clientY - previousTouchY;
    previousTouchX = e.touches[0].clientX;
    previousTouchY = e.touches[0].clientY;
    rotationY += dx * 0.01;
    rotationX += dy * 0.01;
    rotationX = Math.max(-0.8,Math.min(0.8,rotationX));

rotateRoot.rotation.x = rotationX;
rotateRoot.rotation.y = rotationY;

console.log(
  "AFTER TOUCH ROT",
  rotateRoot.rotation.x,
  rotateRoot.rotation.y,
  "VALUES",
  rotationX,
  rotationY
);

  }, { passive:false });


  container.addEventListener("touchend", (e)=>{
    if(e.touches.length===0){
      isDragging=false;
    }
  });

}





// ===== animate =====
function animate(){

    console.log(currentScale);
    renderer.setAnimationLoop(()=>{

        const delta = clock.getDelta();

        if(mixer){

            mixer.update(delta);

        }

if(vrm){

    if(!freezeSpringBone){

        vrm.update(delta);

    }else{

        // SpringBoneを止めた状態でVRMだけ更新
        vrm.update(delta, false);

    }

}

        if(isTracking && modelRoot.scale.x < 1){

          appearProgress += delta * 1.5;

          modelScale = baseScale * appearProgress;

          modelRoot.scale.set(
            modelScale,
            modelScale,
            modelScale
          );

        }

/*        

if(rotateRoot){

    rotateRoot.rotation.x = rotationX;
    rotateRoot.rotation.y = rotationY;

}


if(modelRoot){

    modelRoot.scale.set(
        currentScale,
        currentScale,
        currentScale
    );

}
*/


        renderer.render(scene,camera);

    });


}






photoBtn.onclick = async () => {
  mode = "photo";
  document.querySelector("#menu").style.display = "none";
  document.querySelector("#container").style.display = "block";


  try {

    await start();

  } catch(e) {

    console.error("START ERROR", e);

  }


  captureBtn.style.display = "block";
};

effectBtn.onclick = async () => {
    idleBaseY = "effect";
    document.querySelector("#menu").style.display = "none";
    document.querySelector("#container").style.display = "block";
    await start();
    captureBtn.style.display = "none";
};





upBtn.onclick = () => {

console.log(modelRoot.position.y);

  modelRoot.position.y += 50;
  console.log("UP");
  console.log(modelRoot.position.y);
  rotateRoot.updateMatrixWorld(true);

};


downBtn.onclick = () => {

  modelRoot.position.y -= 50;
  console.log("DOUN");
  console.log(modelRoot.position.y);
  rotateRoot.updateMatrixWorld(true);

};




