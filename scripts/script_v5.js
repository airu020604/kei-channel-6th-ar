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
let appearProgress = 0;
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

let currentAnchor = null;
//次のFOUNDで再生成する
let needReload = false;
//今マーカーが見えている
let isMarkerFound = false;
//VRMが存在する
let hasModel = false;


const captureBtn = document.getElementById("captureBtn");

// ===== メンテナンス用 =====
const audio = new Audio("./sounds/ok.mp3");
const shutter = new Audio("./sounds/ok.mp3");



// ===== スタート関数 =====
async function start(){

    await init();

    await loadVRM();

    await loadVRMA();
    modelRoot.visible = false;

console.log(
    "AFTER LOAD",
    vrm,
    mixer,
    animationAction
);

    await startMindAR();
    modelRoot.visible = true;

    setTimeout(()=>{showMindARUI();},100);
    setTimeout(()=>{showARButtons();},100);
     

    setupInput();

    animate();

}



// ===== 〇〇〇 =====
async function init(){

    clock = new THREE.Clock();

mindarThree = new MindARThree({
    container: document.querySelector("#container"),
    imageTargetSrc:"./targets/targets.mind",
    uiLoading: "no",
    uiScanning: "no",
    uiError: "no",

    rendererOptions:{
        preserveDrawingBuffer:true
    }
});

    renderer = mindarThree.renderer;
    scene = mindarThree.scene;
    camera = mindarThree.camera;

    console.log(
    "CANVAS INFO",
    renderer.domElement,
    renderer.domElement.toDataURL().slice(0,100));

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
  console.log("★★★★★ LOADVRM NEW CODE ★★★★★");

  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.register(parser => new VRMLoaderPlugin(parser));
    loader.load("./models/kei.vrm",
      (gltf) => {
        vrm = gltf.userData.vrm;
        vrm.scene.updateMatrixWorld(true);
        idleBaseY = -0.5;
        vrm.scene.rotation.y = Math.PI;

        vrm.scene.traverse((obj) => {
          if (obj.material) {
            obj.material.needsUpdate = true;
          }
        });

        modelRoot = new THREE.Group();
        rotateRoot = new THREE.Group();

        modelRoot.visible = false;

        rotateRoot.position.set(0,-1,0);
        rotateRoot.rotation.y = Math.PI;

        rotateRoot.add(vrm.scene);
        modelRoot.add(rotateRoot);

        modelRoot.updateMatrixWorld(true);

        if(anchor){
          anchor.group.add(modelRoot);
          anchor.group.updateMatrixWorld(true);
        }

        appearProgress = 0;
        vrm.scene.scale.set(1,1,1);

        modelRoot.scale.set(0.01,0.01,0.01);
        console.log("LOAD ROTATE ROOT",rotateRoot.uuid);
        console.log("SCALE CHECK",modelRoot.scale.x,currentScale,appearProgress);

        resolve();
      },
      undefined,
      (error)=>{
        console.error("VRM LOAD ERROR", error);
        alert("モデル読み込みエラー\n\n" + "回線の良いところで、もう一度お試しください。");
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


// ===== マーカー認識 =====
anchor.onTargetFound = async ()=>{



    currentAnchor = anchor;

    if(isTracking) return;

    isTracking = true;

    console.log("FOUND");

    if(needReload){

        console.log("RELOAD AFTER FOUND");

        await loadVRM(anchor);

        await loadVRMA();

        needReload = false;

    }

    audio.play().catch(() => {});

    if(!vrm){
            console.log("LOAD START");

            await loadVRM(anchor);

            console.log("VRMA START");

            await loadVRMA();

            console.log("VRMA END");
    }
    if(modelRoot){
                console.log(
            "MODEL",
            modelRoot.position,
            modelRoot.visible,
            modelRoot.parent
        );
        modelRoot.visible = true;
    }





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
const el = document.elementFromPoint(
  window.innerWidth / 2,
  window.innerHeight / 2
);

console.log(el);
console.log(el.tagName);
console.log(el.id);
console.log(el.className);

console.log(el);
console.log(getComputedStyle(el).pointerEvents);
console.log(getComputedStyle(el).zIndex);

    /*// 固定前のロスト対策
    if(!isFixed){
        console.log("WAITING FIX");
        return;
    }*/


    // ロード直後は無視
    if(modelRoot && !isFixed){

        console.log("LOST BEFORE FIX IGNORE");

        return;

    }


    if(isLocking){
        console.log("ignore lost during lock");
        return;
    }

  };

}




function fixModel(){

console.log(
  "FIX ROTATE ROOT",
  rotateRoot.uuid
);

  if(isFixed) return;


  const worldPos = new THREE.Vector3();
  const worldQuat = new THREE.Quaternion();
  const worldScale = new THREE.Vector3();


  modelRoot.getWorldPosition(worldPos);
  modelRoot.getWorldQuaternion(worldQuat);
  modelRoot.getWorldScale(worldScale);


  // 親を変更
  scene.add(modelRoot);


  // ワールド座標をローカルへ変換
  scene.worldToLocal(worldPos);

  modelRoot.position.copy(worldPos);
  modelRoot.quaternion.copy(worldQuat);
  modelRoot.scale.copy(worldScale);


  isFixed = true;


  if(vrm.springBoneManager){
    vrm.springBoneManager.reset();
  }


  console.log("MODEL FIXED");


console.log(
  "ROTATE PARENT",
  rotateRoot.parent
);
}


// ===== setupInput Start =====
function setupInput() {
  //const container = document.querySelector("#container");
  const container = document.body;

  console.log("INPUT TARGET",container);

  container.style.touchAction = "none";
  container.addEventListener("mousedown", (e) => {
    isDragging = true;
    previousMouseX = e.clientX;
    previousMouseY = e.clientY;
  });



window.addEventListener("touchstart", ()=>{

    console.log("WINDOW TOUCH");

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
    console.log("TOUCH START");
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

  console.log("TOUCH ROTATE ROOT",rotateRoot.uuid);


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


    //不要かも？
//rotateRoot.rotation.x = rotationX;
//rotateRoot.rotation.y = rotationY;


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

if(isTracking && modelRoot.scale.x < 1){

console.log(
  "APPEAR CHECK",
  {
    isTracking,
    appearProgress,
    baseScale,
    modelRoot,
    scale: modelRoot ? modelRoot.scale.x : "NO MODEL"
  }
);

}

    console.log(currentScale);
    renderer.setAnimationLoop(()=>{

if(isFixed){

    console.log("ANIMATE", modelRoot.position.y);

}

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

        if(isTracking && modelRoot && modelRoot.scale.x < 1){
          //大きくなる速度変更
          appearProgress += delta * 3.5;
          modelScale = baseScale * appearProgress;
          modelRoot.scale.set(modelScale,modelScale,modelScale);

        }

        

if(rotateRoot){
    rotateRoot.rotation.x = rotationX;
    rotateRoot.rotation.y = rotationY;
}

        renderer.render(scene,camera);

    });


}






photoBtn.onclick = async () => {
  mode = "photo";
  document.querySelector("#menu").style.display = "none";

  try {
    await start();
  } catch(e) {
    console.error("START ERROR", e);
    // ===== AR起動エラー =====
    if(e?.name === "NotReadableError"){
        alert("カメラを起動できません。\n\n" + "他のアプリを閉じてから\n" + "もう一度お試しください。");
    }else{
        alert( e?.name + "あれれ～っ\n\n" + "なんでだろ・・・・\n" + "もう一度お試しください。");
    }
  }
};

effectBtn.onclick = async () => {
    idleBaseY = "effect";
    document.querySelector("#menu").style.display = "none";
    document.querySelector("#container").style.display = "block";
    await start();
    captureBtn.style.display = "none";
};






function resetModel(){

    console.log("RESET START");


    // 状態リセット
    isFixed = false;
    isTracking = false;
    isLocking = false;

    appearProgress = 0;
    rotationX = 0;
    rotationY = 0;
    currentScale = 1;


    // モデル削除
    if(modelRoot){
      if(modelRoot.parent){

        modelRoot.parent.remove(modelRoot);

      }

        scene.remove(modelRoot);

        modelRoot.traverse((obj)=>{

            if(obj.geometry){

                obj.geometry.dispose();

            }

            if(obj.material){

                if(Array.isArray(obj.material)){

                    obj.material.forEach(m=>m.dispose());

                }else{

                    obj.material.dispose();

                }

            }

        });

        modelRoot = null;

    }


if(mixer){

    mixer.stopAllAction();
    mixer = null;

}

animationAction = null;


    // 参照破棄
    rotateRoot = null;
    vrm = null;


    console.log("MODEL RESET COMPLETE");

}







async function reloadModel(){

    console.log("RELOAD MODEL");

    isFixed = false;
    isTracking = true;


    await loadVRM(anchor);


    await loadVRMA();


    modelRoot.visible = true;


    setTimeout(()=>{

        fixModel();

    },1500);

}





// ===== MindARUI非表示 =====
function hideMindARUI(){

    document.querySelectorAll(".mindar-ui-overlay")
    .forEach((el)=>{
        el.style.setProperty(
            "display",
            "none",
            "important"
        );
    });

}

// ===== MindARUI表示 =====
function showMindARUI(){

    const overlays = document.querySelectorAll(".mindar-ui-overlay");

    overlays.forEach((overlay)=>{
        overlay.style.setProperty(
            "display",
            "block",
            "important"
        );
    });


    const scannings = document.querySelectorAll(".mindar-ui-scanning");

    scannings.forEach((scanning)=>{
        scanning.style.setProperty(
            "display",
            "block",
            "important"
        );
    });

    captureBtn.style.display = "block";

}


// ===== 操作ボタン表示 =====
function showARButtons(){

    const buttons = document.querySelector("#arButtons");
    const captureBtn = document.getElementById("captureBtn");

    if(buttons){
        buttons.classList.add("show");
    }

}


// ===== メディアシステム =====
async function capturePhoto(){

  console.log("CAPTURE START");

  const video = mindarThree.video;
  const canvas = document.createElement("canvas");

  canvas.width = renderer.domElement.width;
  canvas.height = renderer.domElement.height;

  
  const ctx = canvas.getContext("2d");

  console.log(
        "CANVAS",
        canvas.width,
        canvas.height
    );



  const rect = video.getBoundingClientRect();
  const scaleX = canvas.width / window.innerWidth;
  const scaleY = canvas.height / window.innerHeight;

ctx.drawImage(
    video,
    rect.x * scaleX,
    rect.y * scaleY,
    rect.width * scaleX,
    rect.height * scaleY
);

console.log(
 "AFTER VIDEO DRAW",
 canvas.toDataURL().slice(0,100)
);


    console.log(
  "VIDEO RECT",
  video.getBoundingClientRect()
);
/*
    // カメラ映像
    ctx.drawImage(
        video,
        0,
        0,
        canvas.width,
        canvas.height
    );
*/

/*
    // VRM描画
    ctx.drawImage(
        renderer.domElement,
        0,
        0,
        canvas.width,
        canvas.height
    );
*/

    const img = canvas.toDataURL(
        "image/png"
    );

console.log(
    renderer.domElement.toDataURL().slice(0,50)
);

  console.log(
    "VIDEO STATE",
    video.readyState,
    video.paused,
    video.currentTime
);

console.log(
    "RENDER PNG",
    renderer.domElement.toDataURL().slice(0,120)
);

console.log(
    "RENDER SIZE",
    renderer.domElement.width,
    renderer.domElement.height
);

    //window.open(img);


    const img = canvas.toDataURL("image/png");

const link = document.createElement("a");

link.href = img;

link.download = "kei_channel_AR.png";

link.click();

}


// ===== リセットボタン =====
resetBtn.onclick = ()=>{

    console.log("RESET REQUEST");

    resetModel();

    needReload = true;

};


// ===== ▲ UPボタン =====
upBtn.onclick = () => {
  console.log("UP");

const r = upBtn.getBoundingClientRect();

console.log(
  document.elementFromPoint(
    r.left + r.width / 2,
    r.top + r.height / 2
  )
);


upBtn.addEventListener("pointerdown", ()=>{
    console.log("UP POINTER");
});



  rotateRoot.position.y += 0.05;
  console.log(modelRoot.position.y);
  rotateRoot.updateMatrixWorld(true);
};

// ===== ▼ DOUNボタン =====
downBtn.onclick = () => {
  console.log("DOUN");

downBtn.addEventListener("pointerdown", ()=>{
    console.log("DOWN POINTER");
});  

  rotateRoot.position.y -= 0.05;
  console.log(modelRoot.position.y);
  rotateRoot.updateMatrixWorld(true);
};



// ===== 撮影ボタン =====
captureBtn.onclick = async ()=>{
    console.log(mindarThree.video);
    await capturePhoto();
};
