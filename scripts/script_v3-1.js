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
let mixer = null;
let animationAction = null;
let renderer;
let scene;
let rotateRoot = null;
const clock = new THREE.Clock();
let mode = "photo";
let isTracking = false;
let isLocked = false;
let isDragging = false;
let rotationX = 0;
let rotationY = 0;
let previousMouseX = 0;
let previousMouseY = 0;
let previousTouchX = 0;
let previousTouchY = 0;
let currentScale = 1.0;
let baseLockedY = 0;
let lockTimer = 0;
let autoLocked = false;
let mindarThree = null;
let anchor = null;
let shadow = null;
let camera;
let fixedRoot = null;
let lockedQuaternion = new THREE.Quaternion();
let baseQuaternion = new THREE.Quaternion();


const lockedPosition = new THREE.Vector3();
const lockedScale = new THREE.Vector3();
const resetBtn = document.querySelector("#resetBtn");

const guide = document.querySelector("#guide");
const guideImage = document.querySelector("#guide img");
const guideText = document.querySelector("#guide p");
const controls = document.querySelector("#container");

guide.style.display = "none";
controls.style.display = "none";

guide.style.transition = "0.2s";
guide.style.opacity = "1";
guide.style.filter = "drop-shadow(0 0 40px #00ff66) brightness(2)";
guide.style.transform = "scale(1.05)";


// ===== スタート関数 Start =====
const start = async () => {
  mindarThree = new MindARThree({
  container: document.querySelector("#container"),
  imageTargetSrc: "./targets/targets.mind",

  uiScanning: false,
  uiLoading: false,
  uiError: false
  });

  const renderData = mindarThree;
  renderer = renderData.renderer;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  scene = renderData.scene;
  camera = renderData.camera;
  renderer.preserveDrawingBuffer = true;

  // ===== ライト設定関数 呼び出し =====
  createLight(scene);

  // ===== マーカー0番 =====
  anchor = mindarThree.addAnchor(0);

  // ===== マーカー認識 Start =====
  anchor.onTargetFound = async () => {

    //fixedRoot = new THREE.Group();
    //scene.add(fixedRoot);

    if(!vrm) return;
    if(!rotateRoot) return;

    const audio = new Audio("./sounds/ok.mp3");
    guide.src="./img/guide_ok.png";
    audio.play().catch(() => {});

    if (navigator.vibrate) {
      navigator.vibrate(40);
    }

    if(!isLocked){
      isTracking = true;
    }

if(vrm){
  vrm.scene.visible = true;

  if(!isLocked){
    rotateRoot.position.set(0,0,0);
    rotateRoot.rotation.set(0,0,0);
    rotateRoot.scale.set(1,1,1);
  }
}

    if (animationAction) {
      animationAction.reset();
      animationAction.play();
    }
    lockTimer = 0;

    guide.style.display = "none";


    console.log(
  "FOUND",
  "vrm",
  vrm.scene.visible,
  "root",
  rotateRoot.visible,
  "anchor",
  anchor.group.visible
);

console.log(
  "PARENT NAME",
  rotateRoot.parent.name,
  "TYPE",
  rotateRoot.parent.type
);

console.log(
  "PARENT CHILDREN",
  rotateRoot.parent.children
);



console.log(
 "FOUND WORLD",
 rotateRoot.getWorldPosition(new THREE.Vector3())
);

console.log(
  "ROOT PARENT",
  rotateRoot.parent
);

console.log(
  "ROOT PARENT WORLD",
  rotateRoot.parent.getWorldPosition(new THREE.Vector3())
);

console.log(
  "CHAIN",
  rotateRoot.parent?.type,
  rotateRoot.parent?.parent?.type,
  rotateRoot.parent?.parent?.parent?.type
);

console.log(
 "ANCHOR POS",
 anchor.group.position
);

console.log(
 "ANCHOR SCALE",
 anchor.group.scale
);

setTimeout(()=>{
 console.log(
  "300ms後",
  "vrm",
  vrm.scene.visible,
  "root",
  rotateRoot.visible,
  "anchor",
  anchor.group.visible
 );
},300);

console.log(
  "POS",
  rotateRoot.position,
  "SCALE",
  rotateRoot.scale
);
  }
  // ===== マーカー認識 End =====


  // ===== ターゲットを見失った時 Start =====
  anchor.onTargetLost = async () => {
console.log(
 "AFTER LOST",
 rotateRoot.getWorldPosition(new THREE.Vector3())
);
    console.log("LOST visible:", vrm.scene.visible);

    isTracking = false;

if (!isLocked && vrm) {
  vrm.scene.visible = false;
  guide.style.display = "block";
} else {
  vrm.scene.visible = true;

  console.log(
"LOCK VRM VISIBLE",
vrm.scene.visible,
rotateRoot.visible
);
}
  }
  // ===== ターゲットを見失った時 End =====


  // ===== VRM読み込み関数 呼び出し =====

const textureLoader = new THREE.TextureLoader();
const shadowTexture = textureLoader.load("./img/shadow.png");

shadow = new THREE.Mesh(
  new THREE.PlaneGeometry(0.6,0.6),
  new THREE.MeshBasicMaterial({
    map: shadowTexture,
    transparent:true,
    depthWrite:false
  })
);

shadow.rotation.x = -Math.PI / 2;
shadow.position.set(0,-0.55,0);

await loadVRM(anchor);

if (vrm) {
  vrm.scene.visible = false;
}

await loadVRMA();

rotateRoot.add(shadow);

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

      vrm.scene.scale.setScalar(1);
      vrm.scene.rotation.set(0,Math.PI,0);

      vrm.scene.traverse((obj) => {
        if (obj.material) {
          obj.material.needsUpdate = true;
        }
      });
      rotateRoot = new THREE.Group();
      rotateRoot.add(vrm.scene);
      anchor.group.add(rotateRoot);

console.log(
 "ROTATE ROOT SCALE",
 rotateRoot.scale,
 "VRM SCENE SCALE",
 vrm.scene.scale
);

console.log(
  "LOAD PARENT CHECK",
  rotateRoot.parent,
  rotateRoot.parent.type
);

console.log(
  "INIT SCALE",
  "anchor", anchor.group.scale,
  "root", rotateRoot.scale,
  "vrm", vrm.scene.scale
);

      vrm.scene.visible = false;

console.log(
  "VRM LOCAL",
  vrm.scene.position
);

console.log(
  "VRM SCALE",
  vrm.scene.scale
);

console.log(
  "VRM ROT",
  vrm.scene.rotation
);


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

    if (vrm) {
    vrm.update(delta);
    vrm.springBoneManager?.update(delta);
    }

/*
if(rotateRoot && isLocked){

  rotateRoot.quaternion.copy(
    lockedQuaternion
  );

}
  */


if(rotateRoot && isLocked){

  const touchQ = new THREE.Quaternion()
    .setFromEuler(
      new THREE.Euler(
        rotationX,
        rotationY,
        0
      )
    );


  rotateRoot.quaternion
    .copy(lockedQuaternion)
    .multiply(touchQ);
console.log(
  "FINAL",
  rotateRoot.rotation.x,
  rotateRoot.rotation.y,
  rotateRoot.rotation.z
);

}


    renderer.render(scene,camera);
  });
}
// ===== アニメーション関数 End =====



function getDistance(touches){
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}



function autoLock() {

  if (autoLocked) return;
  if (isLocked) return;
  if (!isTracking) return;
  if (!rotateRoot) return;

  console.log("AUTO LOCK RUN");
  console.log(
    "LOCK CHECK",
    rotateRoot.parent.type,
    rotateRoot.visible,
    rotateRoot.position,
    rotateRoot.children.length
  );

  autoLocked = true;

  lockModel();
}



photoBtn.onclick = async () => {
  mode = "photo";
  document.querySelector("#menu").style.display = "none";
  document.querySelector("#container").style.display = "block";
  await start();
  captureBtn.style.display = "block";
  controls.style.display="block";
  guide.style.display="block";
};

effectBtn.onclick = async () => {
  mode = "effect";
  document.querySelector("#menu").style.display = "none";
  document.querySelector("#container").style.display = "block";
  await start();
  captureBtn.style.display = "none";
};



function lockModel(){

  
  console.log("LOCK BUTTON");


console.log(
  "LOCK START PARENT",
  rotateRoot.parent,
  rotateRoot.parent?.type
);

  if(lockBtn.disabled) return;

  lockBtn.disabled = true;

  setTimeout(()=>{
    lockBtn.disabled = false;
  },300);


  if(!rotateRoot) return;


  if(!isLocked){

    // ワールド座標を保存
    rotateRoot.updateMatrixWorld(true);
  console.log(
  "PARENT SCALE",
  rotateRoot.parent.type,
  rotateRoot.parent.scale,
  rotateRoot.parent.getWorldScale(new THREE.Vector3())
);

console.log(
  "GRAND PARENT",
  rotateRoot.parent.parent,
  rotateRoot.parent.parent?.type,
  rotateRoot.parent.parent?.scale,
  rotateRoot.parent.parent?.getWorldScale(new THREE.Vector3())
);


    const worldPos =
      rotateRoot.getWorldPosition(new THREE.Vector3());

    const worldQuat =
      rotateRoot.getWorldQuaternion(new THREE.Quaternion());

    
      

console.log(
  "ANCHOR SCALE",
  anchor.group.scale
);

    const worldScale = new THREE.Vector3();
rotateRoot.getWorldScale(worldScale);

console.log(
  "BEFORE LOCK SCALE",
  rotateRoot.scale,
  vrm.scene.scale
);
console.log(
  "② WORLD",
  worldPos,
  worldQuat,
  worldScale
);


console.log(
  "PARENT",
  rotateRoot.parent.type,
  rotateRoot.parent.scale,
  rotateRoot.parent.getWorldScale(new THREE.Vector3())
);

console.log(
  "WORLD SCALE",
  worldScale
);

console.log(
  "ANCHOR SCALE",
  anchor.group.scale
);


scene.add(rotateRoot);

  console.log(
  "③ AFTER ADD",
  rotateRoot.parent.type,
  rotateRoot.position,
  rotateRoot.scale
);

console.log(
  "CAMERA POS",
  camera.position,
  "ROOT WORLD",
  rotateRoot.getWorldPosition(new THREE.Vector3())
);




rotateRoot.position.copy(worldPos);
rotateRoot.scale.copy(worldScale);

lockedQuaternion.copy(worldQuat);

rotationX = 0;
rotationY = 0;

/*const euler = new THREE.Euler()
  .setFromQuaternion(lockedQuaternion);

rotationX = euler.x;
rotationY = euler.y;
*/

rotateRoot.rotation.setFromQuaternion(worldQuat);


console.log(
  "AFTER SCENE ADD",
  rotateRoot.position,
  rotateRoot.quaternion,
  rotateRoot.scale
);

console.log(
  "④ AFTER COPY",
  rotateRoot.position,
  rotateRoot.rotation,
  rotateRoot.scale
);
console.log(
  "AFTER LOCK SCALE",
  rotateRoot.scale,
  vrm.scene.scale
);

    rotateRoot.updateMatrixWorld(true);

console.log(
  "⑤ WORLD AFTER",
  rotateRoot.getWorldPosition(new THREE.Vector3())
);

baseQuaternion.copy(
  rotateRoot.quaternion
);

/*
lockedQuaternion.copy(
  rotateRoot.quaternion
);
*/

console.log(
  "SAVE LOCK QUAT",
  lockedQuaternion
);
console.log(
  new THREE.Euler().setFromQuaternion(
    lockedQuaternion,
    "YXZ"
  )
);

isLocked = true;

console.log("⑥ LOCK COMPLETE");

console.log("IS LOCKED =", isLocked);

console.log(
  "VISIBLE AFTER LOCK",
  "root",
  rotateRoot.visible,
  "vrm",
  vrm.scene.visible,
  "parent",
  vrm.scene.parent
);

    isLocked = true;
    lockBtn.textContent = "🔓解除";

  }else{

    // Markerへ戻す
    anchor.group.add(rotateRoot);

    rotateRoot.position.set(0,0,0);
    rotateRoot.rotation.set(0,0,0);
    rotateRoot.scale.set(1,1,1);

    rotateRoot.updateMatrixWorld(true);

    isLocked = false;
    lockBtn.textContent = "📍固定";
  }



}


lockBtn.onclick = ()=>{

    console.log(
 "AFTER LOCK TRANSFORM",
 rotateRoot.position,
 rotateRoot.rotation,
 rotateRoot.scale
);

    lockModel();

};


upBtn.onclick = () => {

 if(!isLocked) return;

 rotateRoot.position.y += 50;

 rotateRoot.updateMatrixWorld(true);

};


downBtn.onclick = () => {

 if(!isLocked) return;

 rotateRoot.position.y -= 50;

 rotateRoot.updateMatrixWorld(true);

};

resetBtn.onclick = () => {

    rotationX = 0;
    rotationY = 0;
    currentScale = 1;

    if (rotateRoot) {
        rotateRoot.rotation.set(0,0,0);
        rotateRoot.scale.setScalar(1);
        rotateRoot.position.y = 0;
    }

    if (vrm) {

        vrm.scene.visible = false;

        if (animationAction) {
            animationAction.reset();
            animationAction.play();
        }

        vrm.springBoneManager?.reset();

    }

    if (isLocked) {

        scene.remove(rotateRoot);
        anchor.group.add(rotateRoot);

        rotateRoot.position.set(0,0,0);
        rotateRoot.quaternion.identity();
        rotateRoot.scale.set(1,1,1);

    }

    isLocked = false;
    isTracking = false;
    autoLocked = false;
    lockTimer = 0;

    lockBtn.textContent = "📍固定";

    guide.style.display = "block";
    guideImage.src = "./img/guide.png";
    guideText.textContent = "マーカーを合わせてください";

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
    //if (!isDragging) return;
    if (!rotateRoot) return;
    const dx = e.clientX - previousMouseX;
    const dy = e.clientY - previousMouseY;

    previousMouseX = e.clientX;
    previousMouseY = e.clientY;
    rotationY += dx * 0.01;
    rotationX += dy * 0.01;
    rotationX = Math.max(-0.8,Math.min(0.8,rotationX));
    console.log("rotation", rotationY);
console.log(
 "TOUCH ROT",
 rotationX,
 rotationY
);

console.log(
"ROT",
rotationY,
isLocked
);

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


document.querySelector("#arButtons")
.addEventListener("touchstart",e=>{
  e.stopPropagation();
});

(window.onload = function() {
  guide.style.display="none";
  controls.style.display="none";
})();