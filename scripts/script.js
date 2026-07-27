//各種インポート
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { VRMLoaderPlugin } from "@pixiv/three-vrm";
import { MindARThree } from "mindar-image-three";

//グローバル変数
let vrm = null;
let appearTime = 0;
let isAppearing = false;
let isTracking = false;
let renderer;

let particles = [];
let particleStartTime = 0;
let isParticlePlaying = false;

let mode = "photo";

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

let currentState = State.HIDDEN;

const photoBtn = document.querySelector("#photoBtn");
const effectBtn = document.querySelector("#effectBtn");
const startBtn = document.querySelector("#startBtn");





//const width = 1080; // 写真の幅をこのサイズに変倍する
//let height = 0; // これは入力ストリームに基づいて計算される

//let streaming = false;





//スタート
const start = async () => {
  
  const mindarThree = new MindARThree({
    container: document.querySelector("#container"),
    imageTargetSrc: "./targets/targets.mind"
  });

const renderData = mindarThree;

renderer = renderData.renderer;
const scene = renderData.scene;
const camera = renderData.camera;
  renderer.preserveDrawingBuffer = true;
  
  // ===== ライト設定関数 =====
  createLight(scene);

 

  // ===== マーカー0番 =====
  const anchor = mindarThree.addAnchor(0);

  createParticles(anchor);

  anchor.onTargetFound = () => {
for (const p of particles) {

    p.visible = true;

    // 初期位置へ戻す
    p.position.set(0, 0.2, 0);

    // 大きさを戻す
    p.scale.set(1, 1, 1);

    // 透明度を戻す
    p.material.opacity = 1;

    // 新しい速度を毎回設定
    p.userData.velocity.set(
        (Math.random() - 0.5) * 0.06,
        Math.random() * 0.08 + 0.02,
        (Math.random() - 0.5) * 0.06
    );

}

particleStartTime = clock.getElapsedTime();

isParticlePlaying = true;

    if (!vrm) return;
    if (isTracking) return;
    isTracking = true;

    appearTime = 0;
    isAppearing = true;

    vrm.scene.position.set(0, -0.8, 0);
    vrm.scene.scale.set(0.35, 0.35, 0.35);

    vrm.scene.traverse((obj) => {
      if (obj.isMesh) {
        obj.material.opacity = 0;
      }
    });



  };

  anchor.onTargetLost = () => {
    if (!vrm) return;
    isTracking = false;
    vrm.scene.traverse((obj) => {
      if (obj.isMesh) {
        obj.material.opacity = 0;
      }
    });
  };



  // ===== Cube作成関数 =====
  const cube = createCube();

  // ===== VRM読み込み関数 =====
  await loadVRM(anchor);
  
  //anchor.group.add(cube);
  await mindarThree.start();
document.getElementById("cameraUI").style.position = "fixed";
document.getElementById("cameraUI").style.left = "50%";
document.getElementById("cameraUI").style.bottom = "300px";
document.getElementById("cameraUI").style.transform = "translateX(-50%)";
console.log(renderer.domElement.style.height);
console.log(renderer.domElement.style.width);
console.log(window.innerHeight);
console.log(document.querySelector("#container").getBoundingClientRect());

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
function createLight(scene) {
  const light = new THREE.HemisphereLight(0xffffff, 0xbbbbff, 1);
  scene.add(light);
}


// ===== VRM読み込み関数 =====
function loadVRM(anchor) {
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.register(parser => new VRMLoaderPlugin(parser));
    loader.load("./models/kei.vrm",
      (gltf) => {
        vrm = gltf.userData.vrm;
        vrm.scene.scale.set(1, 1, 1);
        vrm.scene.position.set(0, -0.6, 0);
        vrm.scene.rotation.y = Math.PI;

        vrm.scene.traverse((obj) => {
          if (obj.isMesh) {
           obj.material.transparent = true;
           obj.material.opacity = 0;
          }
        });

        anchor.group.add(vrm.scene);
        resolve();
      },
      undefined,
      reject
    );
  });
}


function animate(renderer, scene, camera) {

  renderer.setAnimationLoop(() => {

    const delta = clock.getDelta();

    // パーティクル更新
    if (isParticlePlaying) {

    const t = clock.getElapsedTime() - particleStartTime;

    for (const p of particles) {

        p.position.add(p.userData.velocity);
        p.userData.velocity.multiplyScalar(0.96);
        p.material.opacity = 1 - t;
        p.scale.multiplyScalar(1.01);

    }

    if (t > 1) {

        for (const p of particles) {
            p.scale.set(1,1,1);
            p.visible = false;

        }

        isParticlePlaying = false;

    }

}

    // VRM更新
    if (vrm) {

      vrm.update(delta);

      if (isAppearing) {

        appearTime += delta;

        const t = Math.min(appearTime / 1.5, 1);
        const ease = 1 - Math.pow(1 - t, 3);

        vrm.scene.position.y = -0.8 + (0.2 * ease);

        const scale = 0.35 + (0.10 * ease);
        vrm.scene.scale.set(scale, scale, scale);

        vrm.scene.traverse((obj) => {
          if (obj.isMesh) {
            obj.material.opacity = ease;
          }
        });

        if (t >= 1) {
          isAppearing = false;
        }
      }
    }

    renderer.render(scene, camera);

  });

}



function createParticles(anchor) {

    particles = [];

    for (let i = 0; i < 30; i++) {

        const particle = new THREE.Mesh(

            new THREE.SphereGeometry(0.02, 8, 8),

            new THREE.MeshBasicMaterial({
                color: 0xffdd66,
                transparent: true,
                opacity: 1
            })

        );

        particle.visible = false;

        particle.userData.velocity = new THREE.Vector3(
          (Math.random() - 0.5) * 0.06,
          Math.random() * 0.08 + 0.02,
          (Math.random() - 0.5) * 0.06
        );

        anchor.group.add(particle);

        particles.push(particle);

    }

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



startBtn.onclick = async () => {

photoBtn.onclick = () => {

    const link = document.createElement("a");

    link.download = "KeiAR.png";

    link.href = renderer.domElement.toDataURL("image/png");

    link.click();

};

  document.querySelector("#menu").style.display = "none";
  document.querySelector("#container").style.display = "block";
  await start();
};