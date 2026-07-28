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


//スタート
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

  
  // ===== ライト設定関数 =====
  createLight(scene);

  // ===== マーカー0番 =====
  const anchor = mindarThree.addAnchor(0);


  anchor.onTargetFound = () => {
  vrm.scene.visible = true;
  particleStartTime = clock.getElapsedTime();

  if (!vrm) return;
    if (isTracking) return;
      isTracking = true;
      appearTime = 0;
      vrm.scene.visible = true;

      vrm.scene.position.set(0, -0.8, 0);
      vrm.scene.scale.set(0.6, 0.6, 0.6);
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

    obj.material.transparent = true;
    //obj.material.opacity = 0;

    if (animationAction) {

    animationAction.reset();

    animationAction.play();

}

});



  };

  anchor.onTargetLost = () => {
  vrm.scene.visible = false;
  };



  // ===== Cube作成関数 =====
  const cube = createCube();

  // ===== VRM読み込み関数 =====
  await loadVRM(anchor);

  await loadVRMA();
  
  //anchor.group.add(cube);
  await mindarThree.start();
  animate(renderer, scene, camera);
};

// ===== Cube作成関数 =====
function createCube() {
  const geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5);
  const material = new THREE.MeshStandardMaterial({ color: 0xff6600 });
  const cube = new THREE.Mesh(geometry, material);
  cube.position.set(-0.5, 0.25, 0);
  return cube;
}

// ===== ライト設定関数 =====
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


// ===== VRM読み込み関数 =====
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

        anchor.group.add(vrm.scene);
        vrm.scene.visible = false;
        resolve();
      },
      undefined,
      reject
    );
  });
}



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
    animationAction.reset();

animationAction.setLoop(THREE.LoopOnce, 1);

animationAction.clampWhenFinished = true;

animationAction.enabled = true;

animationAction.play();

animationAction.setLoop(
    THREE.LoopOnce,
    1
);


    animationAction.play();

}


function animate(renderer, scene, camera) {

  renderer.setAnimationLoop(() => {

    const delta = clock.getDelta();







if (mixer) {

    mixer.update(delta);

}

    // VRM更新
    if (vrm) {

      vrm.update(delta);
      

if(vrm){

    vrm.update(delta);

}

    }

    renderer.render(scene, camera);

  });

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