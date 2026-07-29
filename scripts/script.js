// ===== 各種インポート =====
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { VRMLoaderPlugin } from "@pixiv/three-vrm";
import { MindARThree } from "mindar-image-three";

import {
  VRMAnimationLoaderPlugin,
  createVRMAnimationClip
} from "@pixiv/three-vrm-animation";


// ===== グローバル変数 =====
let vrm = null;
let appearTime = 0;
let isAppearing = false;
let isTracking = false;
let renderer;
let mode = "photo";
let currentState;
let idleBaseY = -0.6;
let blinkTimer = 0;
let mixer = null;
let animationAction = null;
let modelRoot = null;
let worldLocked = false;
let isDragging = false;
let lastTouchX = 0;
let rotateRoot = null;

let previousMouseX = 0;

let rotationY = 0;
let rotationX = 0;
let previousTouchX = 0;
let previousTouchY = 0;
let previousMouseY = 0;
let currentScale = 1.0;

let pinchDistance = 0;
let lastScale = 1;



const lockedPosition = new THREE.Vector3();
const lockedQuaternion = new THREE.Quaternion();
const lockedScale = new THREE.Vector3();


// ===== 変化しない変数の設定 =====
const clock = new THREE.Clock();

const State = {
  HIDDEN: 0,
  APPEARING: 1,
  IDLE: 2,
  EFFECT: 3
};

const Motion = {
  DANCE: "dance",
  WAVE: "wave",
  POSE: "pose"
}
//playMotion(Motion.DANCE);

currentState = State.HIDDEN;
const photoBtn = document.querySelector("#photoBtn");
const effectBtn = document.querySelector("#effectBtn");
const startBtn = document.querySelector("#startBtn");


// ===== スタート関数 Start =====
const start = async () => {
  
  const mindarThree = new MindARThree({
    container: document.querySelector("#container"),
    imageTargetSrc: "./targets/targets.mind"
  });

  const renderData = mindarThree;
  renderer = renderData.renderer;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  const scene = renderData.scene;
  const camera = renderData.camera;

  renderer.preserveDrawingBuffer = true;

  
  // ===== ライト設定関数 呼び出し =====
  createLight(scene);

  // ===== マーカー0番 =====
  const anchor = mindarThree.addAnchor(0);


//
  anchor.onTargetFound = () => {
    
    vrm.scene.visible = true;
    //particleStartTime = clock.getElapsedTime();

    if (!vrm) return;

    if (isTracking) return;

    isTracking = true;
    appearTime = 0;
    vrm.scene.visible = true;
    vrm.scene.position.set(0, -0.4, 0);
    vrm.scene.scale.set(1, 1, 1);
    vrm.lookAt = null;
    vrm.scene.traverse((obj) => {

      if (!obj.isMesh) return;

      const name = obj.name.toLowerCase();

      // 目・顔は透明化しない
      if (
        name.includes("eye") ||
        name.includes("face")
        ) {
          return;
        }

if (animationAction) {

    vrm.humanoid?.resetNormalizedPose();

    vrm.springBoneManager?.reset();

    mixer.setTime(0);

    animationAction.reset();

    animationAction.play();

}
    });
if (animationAction) {

    vrm.humanoid?.resetNormalizedPose();

    vrm.springBoneManager?.reset();

    mixer.setTime(0);

    animationAction.reset();

    animationAction.play();

}

  /*  
  if (!worldLocked) {
    modelRoot.updateMatrixWorld(true);
    modelRoot.getWorldPosition(lockedPosition);
    modelRoot.getWorldQuaternion(lockedQuaternion);
    modelRoot.getWorldScale(lockedScale);
    anchor.group.remove(modelRoot);
    scene.add(modelRoot);
    modelRoot.position.copy(lockedPosition);
    modelRoot.quaternion.copy(lockedQuaternion);
    modelRoot.scale.copy(lockedScale);
    worldLocked = true;
  }*/
};

  // ===== ターゲットを見失った時 =====
anchor.onTargetLost = () => {

    if (!vrm) return;

    vrm.scene.visible = false;

    isTracking = false;

    if (animationAction) {

        animationAction.stop();

        animationAction.reset();

    }

    if (mixer) {

        mixer.setTime(0);

    }

    vrm.humanoid?.resetNormalizedPose();

    vrm.springBoneManager?.reset();

};

  // ===== Cube作成関数 =====
  const cube = createCube();

  // ===== VRM読み込み関数 呼び出し =====
  await loadVRM(anchor);

  // ===== VRMA読み込み関数 呼び出し =====
  await loadVRMA();
  
  //anchor.group.add(cube);
  await mindarThree.start();
  setupInput();
  animate(renderer, scene, camera);


  
};
// ===== スタート関数 End =====


// ===== Cube作成関数 =====
function createCube() {
  const geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
  const material = new THREE.MeshStandardMaterial({ color: 0xff6600 });
  const cube = new THREE.Mesh(geometry, material);
  cube.position.set(-0.5, 0.25, 0);
  return cube;
}


// ===== ライト設定関数 Start =====
function createLight(scene){
  const hemi = new THREE.HemisphereLight(
    0xffffff,
    0x666666,
    2
  );
  scene.add(hemi);

  const dir = new THREE.DirectionalLight(
    0xffffff,
    3
  );
  dir.position.set(0,3,2);
  scene.add(dir);
}
// ===== ライト設定関数 End =====


// ===== VRM読み込み関数 Start =====
function loadVRM(anchor) {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.register(parser => new VRMLoaderPlugin(parser));
    loader.load("./models/kei.vrm",
    (gltf) => {
      vrm = gltf.userData.vrm;
      if (vrm.lookAt) {
        vrm.lookAt.autoUpdate = false;
      }

      vrm.scene.scale.set(1, 1, 1);
      vrm.scene.position.set(0, -0.6, 0);
      idleBaseY = -0.6;
      vrm.scene.rotation.y = Math.PI;

      vrm.scene.traverse((obj) => {
        if (obj.material) {
          obj.material.needsUpdate = true;
        }
      });

      modelRoot = new THREE.Group();
      rotateRoot = new THREE.Group();
      rotateRoot.add(vrm.scene);
      modelRoot.add(rotateRoot);
      anchor.group.add(modelRoot);


        //vrm.scene.visible = false;
        resolve();
      },
      undefined,
      reject
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
  const clip = createVRMAnimationClip(vrmAnimation, vrm);

  mixer = new THREE.AnimationMixer(vrm.scene);
  animationAction = mixer.clipAction(clip);

  if(animationAction){
    vrm.humanoid?.resetNormalizedPose();
    vrm.springBoneManager?.reset();
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


// ===== アニメーション関数 Start =====
function animate(renderer, scene, camera) {
  renderer.setAnimationLoop(() => {
    const delta = clock.getDelta();
    if (mixer) {
      mixer.update(delta);
    }
    if (rotateRoot) {
      rotateRoot.rotation.y += (rotationY - rotateRoot.rotation.y) * 0.15;

      rotateRoot.rotation.x += (rotationX - rotateRoot.rotation.x) * 0.15;



    if (currentScale !== lastScale) {
      rotateRoot.scale.setScalar(currentScale);
      lastScale = currentScale;
    }

    }
    // VRM更新
    if (vrm) {
      //vrm.update(delta);
    }
    renderer.render(scene, camera);
  });
}
// ===== アニメーション関数 End =====



function getDistance(touches){

    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;

    return Math.sqrt(dx * dx + dy * dy);

}



photoBtn.onclick = async () => {
  mode = "photo";
  document.querySelector("#menu").style.display = "none";
  document.querySelector("#container").style.display = "block";
  await start();
  captureBtn.style.display = "block";
};

effectBtn.onclick = async () => {
    mode = "effect";
    document.querySelector("#menu").style.display = "none";
    document.querySelector("#container").style.display = "block";
    await start();
    captureBtn.style.display = "none";
};







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

  }, { passive:false });

  container.addEventListener("touchmove", (e) => {

    if (e.touches.length === 2){
      const distance = getDistance(e.touches);
      const diff = distance - pinchDistance;
      pinchDistance = distance;
      currentScale += diff * 0.003;
      currentScale = Math.max(
        0.5,
        Math.min(
          3,
          currentScale
        )
      );
    return;
    }



    e.preventDefault();

    if (!rotateRoot) return;

    if (!isDragging) return;

    const dx = e.touches[0].clientX - previousTouchX;
    const dy = e.touches[0].clientY - previousTouchY;

    previousTouchX = e.touches[0].clientX;
    previousTouchY = e.touches[0].clientY;

    rotationY += dx * 0.01;
    rotationX += dy * 0.01;

    rotationX = Math.max(
    -0.8,
    Math.min(
        0.8,
        rotationX
    )
);

  }, { passive:false });


container.addEventListener("touchend", (e)=>{

    if(e.touches.length===0){

        isDragging=false;

    }

});

}



