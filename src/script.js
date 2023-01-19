import './style.css'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import * as dat from 'lil-gui'
import * as CANNON from 'cannon-es'


class BasicCharacterControls {
    constructor(params) {
        this._Init(params)
    }

    _Init(params) {
        this._params = params
        this._move = {
            forward: false,
            backward: false,
            left: false,
            right: false
        }
        this._decceleration = new THREE.Vector3(-0.0005, -0.0001, -5.0)
        this._acceleration = new THREE.Vector3(1, 0.25, 50.0)
        this._velocity = new THREE.Vector3(0, 0, 0)

        document.addEventListener('keydown', (e) => this._onKeyDown(e), false)
        document.addEventListener('keyup', (e) => this._onKeyUp(e), false)
    }

    _onKeyDown(event) {
        switch (event.keyCode) {
            case 87: //w
                this._move.forward = true
                break
            case 65: //a
                this._move.left = true
                break
            case 83: //s
                this._move.backward = true
                break
            case 68: //d
                this._move.right = true
                break
            case 38: // up
            case 37: // left
            case 40: // down
            case 39: // right
                  break;
        }
    }

    _onKeyUp(event) {
        switch (event.keyCode) {
            case 87: //w
                this._move.forward = false
                break
            case 65: //a
                this._move.left = false
                break
            case 83: //s
                this._move.backward = false
                break
            case 68: //d
                this._move.right = false
                break
            case 38: // up
            case 37: // left
            case 40: // down
            case 39: // right
                  break;
        }
    }

    Update(timeInSeconds) {
        const velocity = this._velocity
        const frameDecceleration = new THREE.Vector3(
            velocity.x * this._decceleration.x,
            velocity.y * this._decceleration.y,
            velocity.z * this._decceleration.z
        )
        frameDecceleration.multiplyScalar(timeInSeconds)
        frameDecceleration.z = Math.sign(frameDecceleration.z) * Math.min(Math.abs(frameDecceleration.z), Math.abs(velocity.z)) 
        velocity.add(frameDecceleration)

        const controlObject = this._params.target
        const _Q = new THREE.Quaternion()
        const _A = new THREE.Vector3()
        const _R = controlObject.quaternion.clone()

        if (this._move.forward) {
            velocity.z += this._acceleration.z * timeInSeconds
        }
        if (this._move.backward) {
            velocity.z -= this._acceleration.z * timeInSeconds
        }
        if (this._move.left) {
            _A.set(0, 1, 0)
            _Q.setFromAxisAngle(_A, Math.PI * timeInSeconds * this._acceleration.y)
            _R.multiply(_Q)
        }
        if (this._move.right) {
            _A.set(0, 1, 0)
            _Q.setFromAxisAngle(_A, - Math.PI * timeInSeconds * this._acceleration.y)
            _R.multiply(_Q)
        }

        controlObject.quaternion.copy(_R)

        const oldPosition = new THREE.Vector3()
        oldPosition.copy(controlObject.position)

        const forward = new THREE.Vector3(0, 0, 1)
        forward.applyQuaternion(controlObject.quaternion)
        forward.normalize()

        const sideways = new THREE.Vector3(1, 0, 0)
        sideways.applyQuaternion(controlObject.quaternion)
        sideways.normalize()

        sideways.multiplyScalar(velocity.x * timeInSeconds)
        forward.multiplyScalar(velocity.z * timeInSeconds)

        controlObject.position.add(forward)
        controlObject.position.add(sideways)

        oldPosition.copy(controlObject.position)
    }
}


class BasicWorld {

    //== CONSTRUCTOR =========== > >
    constructor(){
        this._Initialize()
    }

    //== INIRIALIZER =========== > >
    _Initialize(){
        //--GUI--
        const gui = new dat.GUI()

        //--RENDERER--
        const canvas = document.querySelector('canvas.webgl')
        this._threejs = new THREE.WebGLRenderer({
            canvas: canvas,
            antialias: true
        })
        this._threejs.shadowMap.enabled = true
        this._threejs.shadowMap.type = THREE.PCFSoftShadowMap
        this._threejs.setPixelRatio(window.devicePixelRatio)
        this._threejs.setSize(window.innerWidth, window.innerHeight)

        //--WINDOW RESIZE SETTING--
        window.addEventListener('resize', () => {
            this._OnWindowResize()
        }, false)

        //--CAMERA--
        const fov = 60
        const aspect = 1920 / 1080
        const near = 1.0
        const far = 1000.0
        this._camera = new THREE.PerspectiveCamera(fov, aspect, near, far)
        this._camera.position.set(15, 20, 45)

        //--SCENE--
        this._scene = new THREE.Scene()
        
        //--LIGHT--
        const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0)
        directionalLight.position.set(20, 100, 10)
        directionalLight.target.position.set(0, 0, 0)
        directionalLight.castShadow = true
        directionalLight.shadow.bias = -0.001
        directionalLight.shadow.mapSize.width = 2048
        directionalLight.shadow.mapSize.height = 2048
        directionalLight.shadow.camera.near = 0.1
        directionalLight.shadow.camera.far = 500.0
        directionalLight.shadow.camera.near = 0.5
        directionalLight.shadow.camera.far = 500.0
        directionalLight.shadow.camera.left = 100
        directionalLight.shadow.camera.right = -100
        directionalLight.shadow.camera.top = 100
        directionalLight.shadow.camera.bottom = -100
        this._scene.add(directionalLight)

        const directionalLightHelper = new THREE.CameraHelper(directionalLight.shadow.camera)
        directionalLightHelper.visible = false
        gui.add(directionalLightHelper, 'visible').name('DirectionalLight')
        this._scene.add(directionalLightHelper)

        const ambientLight = new THREE.AmbientLight(0x101010)
        this._scene.add(ambientLight)

        //--CONTROLS--
        const controls = new OrbitControls(this._camera, canvas)
        controls.target.set(0, 20, 0)
        controls.update()

        //--AXESHELPER--
        const axesHelper = new THREE.AxesHelper(10)
        axesHelper.visible = false
        gui.add(axesHelper, 'visible').name('Axes')
        this._scene.add(axesHelper)

        //--ENVIROMENT TEXTURE--
        const cubeTextureLoader = new THREE.CubeTextureLoader()
        const environmentMaps = cubeTextureLoader.load([
            '/textures/environmentMaps/6/px.png',
            '/textures/environmentMaps/6/nx.png',
            '/textures/environmentMaps/6/py.png',
            '/textures/environmentMaps/6/ny.png',
            '/textures/environmentMaps/6/pz.png',
            '/textures/environmentMaps/6/nz.png'
        ])
        this._scene.background = environmentMaps

        //--FLOOR--
        const plane = new THREE.Mesh(
            new THREE.PlaneGeometry(100, 100, 10, 10),
            new THREE.MeshStandardMaterial({ color: 0xffffff })
        )
        plane.castShadow = false
        plane.receiveShadow = true
        plane.rotation.x = - Math.PI / 2
        this._scene.add(plane)

        //--LOAD ANIMATED MODEL--
        this._mixers = []
        this._previousRAF = null
        this._LoadAnimatedModel()
        this._LoadGLTFModel()

        // this._LoadAnimatedModelAndPlay(
        //     'models/james/',
        //     'Ch06_nonPBR.fbx',
        //     'dance.fbx',
        //     new THREE.Vector3(0, -1.5, 5)
        // )

        //--REQUEST ANIMATION FRAME--
        this._RAF()
    }

    //== FUNC: LOAD FBX MODEL =========== > >
    _LoadAnimatedModel() {
        const fbxLoader = new FBXLoader()
        fbxLoader.setPath('/models/james/')
        fbxLoader.load('Ch06_nonPBR.fbx', (fbx) => {
            fbx.scale.set(0.1, 0.1, 0.1)
            fbx.traverse(c => {
                c.castShadow = true
            })

            //--CHARACTER CONTROL--
            const params = {
                target: fbx,
                camera: this._camera
            }
            this._controls = new BasicCharacterControls(params)

            //--CHARACTER ANIMATION--
            const animFBXLoader = new FBXLoader()
            animFBXLoader.setPath('/models/james/')
            animFBXLoader.load('dance.fbx', (animFBXLoader) => {
                const m = new THREE.AnimationMixer(fbx)
                this._mixers.push(m)
                const idle = m.clipAction(animFBXLoader.animations[0])
                idle.play()
            })
            this._scene.add(fbx)
        })
    }

    //== FUNC: LOAD FBX MODEL + ANIMATION =========== > >
    _LoadAnimatedModelAndPlay(path, modelFile, animFile, offset) {
        const fbxLoader = new FBXLoader()
        fbxLoader.setPath(path)
        fbxLoader.load(modelFile, (fbx) => {
            fbx.scale.set(0.1, 0.1, 0.1)
            fbx.traverse(c => {
                c.castShadow = true
            })
            fbx.position.copy(offset)

            const animFBXLoader = new FBXLoader()
            animFBXLoader.setPath(path)
            animFBXLoader.load(animFile, (animFBXLoader) => {
                const m = new THREE.AnimationMixer(fbx)
                this._mixers.push(m)
                const idle = m.clipAction(animFBXLoader.animations[0])
                idle.play()
            })
            this._scene.add(fbx)
        })
    }

    //== FUNC: LOAD GLTF MODEL =========== > >
    _LoadGLTFModel() {
        const gltfLoader = new GLTFLoader()
        gltfLoader.load('/models/FlightHelmet/glTF/FlightHelmet.gltf', (gltf) => {
            gltf.scene.traverse(c => {
                c.castShadow = true
            })
            gltf.scene.scale.set(10, 10, 10)
            this._scene.add(gltf.scene)
        })
    }

    //== FUNC: WINDOW RESIZE =========== > >
    _OnWindowResize() {
        this._camera.aspect = window.innerWidth / window.innerHeight
        this._camera.updateProjectionMatrix()
        this._threejs.setPixelRatio(window.devicePixelRatio)
        this._threejs.setSize(window.innerWidth, window.innerHeight)
    }


    //== FUNC: REQUEST ANIMATION FRAME =========== > >
    _RAF() {
        requestAnimationFrame((t) => {
            if (this._previousRAF === null) {
                this._previousRAF = t
            }

            this._RAF()

            this._threejs.render(this._scene, this._camera)
            this._Step(t - this._previousRAF)
            this._previousRAF = t
        })
    }

    //== FUNC: SET ANIMATION & CONTROL UPDATE STEP =========== > >
    _Step(timeElapsed) {
        const timeElapsedS = timeElapsed * 0.001
        if (this._mixers) {
            this._mixers.map(m => m.update(timeElapsedS))
        }

        if (this._controls) {
            this._controls.Update(timeElapsedS)
        }
    }
}

let _APP = null

window.addEventListener('DOMContentLoaded', () => {
    _APP = new BasicWorld()
})




// //Settings ==================================================================

// //--GUI---
// const gui = new dat.GUI()
// const debugObject = {}

// debugObject.createSphere = () =>
// {
//     createSphere(
//         Math.random() * 0.5, 
//         {
//             x: (Math.random() - 0.5) * 3, 
//             y: 3, 
//             z: (Math.random() - 0.5) * 3
//         }
//     )
// }
// debugObject.createBox = () =>
// {
//     createBox(
//         Math.random(),
//         Math.random(),
//         Math.random(),
//         {
//             x: (Math.random() - 0.5) * 3,
//             y: 3,
//             z: (Math.random() - 0.5) * 3
//         }
//     )
// }
// gui.add(debugObject, 'createSphere')
// gui.add(debugObject, 'createBox')


// //---ENVIROMENT TEXTURE---
// const textureLoader = new THREE.TextureLoader()
// const cubeTextureLoader = new THREE.CubeTextureLoader()
// const environmentMapTexture = cubeTextureLoader.load([
//     '/textures/environmentMaps/0/px.png',
//     '/textures/environmentMaps/0/nx.png',
//     '/textures/environmentMaps/0/py.png',
//     '/textures/environmentMaps/0/ny.png',
//     '/textures/environmentMaps/0/pz.png',
//     '/textures/environmentMaps/0/nz.png'
// ])


// //---CANVAS----
// const canvas = document.querySelector('canvas.webgl')
// const scene = new THREE.Scene()
// scene.background = new THREE.Color(0xa8def0);
// const sizes = {
//     width: window.innerWidth,
//     height: window.innerHeight
// }
// window.addEventListener('resize', () =>
// {
//     sizes.width = window.innerWidth
//     sizes.height = window.innerHeight
//     camera.aspect = sizes.width / sizes.height
//     camera.updateProjectionMatrix()
//     renderer.setSize(sizes.width, sizes.height)
//     renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
// })

// //---SOUNDS---
// const hitSound = new Audio('/sounds/hit.mp3')
// const playHitSound = (collision) => 
// {
//     const impactStrength = collision.contact.getImpactVelocityAlongNormal()
    
//     if (impactStrength > 1.5)
//     {
//         hitSound.volume = Math.random()
//         hitSound.currentTime = 0
//         hitSound.play()
//     }
// }

// //---CAMERA---
// const camera = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 0.1, 100)
// camera.position.set(- 3, 3, 3)
// scene.add(camera)

// //---CONTROLS---
// const controls = new OrbitControls(camera, canvas)
// controls.enableDamping = true

// //---RENDERER---
// const renderer = new THREE.WebGLRenderer({
//     canvas: canvas
// })
// renderer.shadowMap.enabled = true
// renderer.shadowMap.type = THREE.PCFSoftShadowMap
// renderer.setSize(sizes.width, sizes.height)
// renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

// //---LIGHTs---
// light()

// //---PHYSICS SETUP---

// //------world
// const world = new CANNON.World()
// world.broadphase = new CANNON.SAPBroadphase(world)      //for better collision calc (CPU)
// world.allowSleep = true                                 //for better collision calc (CPU)
// world.gravity.set(0, -9.82, 0)

// //------materials
// const defaultMaterial = new CANNON.Material('default')
// const defaultContactMaterial = new CANNON.ContactMaterial(
//     defaultMaterial,
//     defaultMaterial,
//     {
//         friction: 0.1,
//         restitution: 0.8
//     }
// )
// world.addContactMaterial(defaultContactMaterial)
// world.defaultContactMaterial = defaultContactMaterial

// //---FLOOR (+ physics)---
// generateFloor()


// //Placing objects ==================================================================


// //--load glb model with animation
// let mixer = null
// new GLTFLoader().load('models/RobotExpressive.glb', (gltf) => {
//     //load model
//     const model = gltf.scene
//     model.traverse((object) => {
//         if (object.isMesh) object.castShadow = true
//     })
//     const scale = 0.4
//     model.scale.set(scale, scale, scale)
//     scene.add(model)

//     //collision boarder
//     const collisionBox = new THREE.Mesh(
//         new THREE.BoxGeometry(1, 2, 1),
//         new THREE.MeshStandardMaterial({ color:'0xff0000' })
//     )
//     collisionBox.position.y = 1
//     collisionBox.material.wireframe = true
//     scene.add(collisionBox)

//     //cannon.js body
//     const robotDimension = {x: 1, y: 2, z: 1}
//     const shape = new CANNON.Box(new CANNON.Vec3(robotDimension.x * 0.5, robotDimension.y * 0.5, robotDimension.z * 0.5))
//     const body = new CANNON.Body({
//         mass: 0,
//         position: new CANNON.Vec3(0, 0, 0),
//         shape: shape,
//         material: defaultMaterial
//     })
//     body.position.copy(collisionBox.position)
//     world.addBody(body)

//     //add animation
//     console.log(gltf)

//     mixer = new THREE.AnimationMixer(gltf.scene)
//     const action = mixer.clipAction(gltf.animations[10])
//     action.play() 
// })




// const loader = new FBXLoader()
// loader.setPath('models/james/');loader.load('Ch06_nonPBR.fbx', (fbx) => {
//   fbx.traverse(c => {
//     c.castShadow = true
//   })
//   const scale = 0.02
//   fbx.scale.set(scale, scale, scale)
//   fbx.position.z = -1
//   scene.add(fbx)
// })



// //--axesHelper
// const axesHelper = new THREE.AxesHelper(2)
// axesHelper.visible = false
// scene.add(axesHelper)
// gui.add(axesHelper, 'visible').name('axes - Helper')










// //07 utils
// const objectsToUpdate = []

// //--sphere create function 
// const sphereGeometry = new THREE.SphereGeometry(1, 20, 20)
// const sphereMaterial = new THREE.MeshStandardMaterial({
//     metalness: 0.3,
//     roughness: 0.4,
//     envMap: environmentMapTexture
// })

// const createSphere = (radius, position) => 
// {
//     //three.js
//     const mesh = new THREE.Mesh(sphereGeometry,sphereMaterial)
//     mesh.scale.set(radius, radius, radius)
//     mesh.castShadow = true
//     mesh.position.copy(position)
//     scene.add(mesh)

//     //cannon.js body
//     const shape = new CANNON.Sphere(radius)
//     const body = new CANNON.Body({
//         mass: 1,
//         position: new CANNON.Vec3(0, 0, 0),
//         shape: shape,
//         material: defaultMaterial
//     })
//     body.position.copy(position)
//     body.addEventListener('collide', playHitSound)
//     world.addBody(body)

//     //save in objects to update
//     objectsToUpdate.push({
//         mesh: mesh,
//         body: body
//     })
// }

// //--box create function
// const boxGeometry = new THREE.BoxGeometry(1, 1, 1)
// const boxMaterial = new THREE.MeshStandardMaterial({
//     metalness: 0.3,
//     roughness: 0.4,
//     envMap: environmentMapTexture
// })

// const createBox = (width, height, depth, position) => 
// {
//     //three.js
//     const mesh = new THREE.Mesh(boxGeometry, boxMaterial)
//     mesh.scale.set(width, height, depth)
//     mesh.castShadow = true
//     mesh.position.copy(position)
//     scene.add(mesh)
    
//     //cannon.js body
//     const shape = new CANNON.Box(new CANNON.Vec3(width * 0.5, height * 0.5, depth * 0.5))
//     const body = new CANNON.Body({
//         mass: 1,
//         position: new CANNON.Vec3(0, 3, 0),
//         shape: shape,
//         material: defaultMaterial
//     })
//     body.position.copy(position)
//     body.addEventListener('collide', playHitSound)
//     world.addBody(body)

//     objectsToUpdate.push({
//         mesh: mesh,
//         body: body
//     })
// }

// //--control keys
// const keysPressed = {}
// document.addEventListener('keydown', (event)=> {
//     (keysPressed)[event.key.toLowerCase()] = true
// }, false)

// document.addEventListener('keyup', (event)=> {
//     (keysPressed)[event.key.toLowerCase()] = false
// }, false)


// //08 animate
// const clock = new THREE.Clock()
// let oldElapsedTime = 0

// const tick = () =>
// {
//     const elapsedTime = clock.getElapsedTime()
//     const deltaTime = elapsedTime - oldElapsedTime
//     oldElapsedTime = elapsedTime


//     //update physics world
//     world.step(1/60, deltaTime, 3)

//     for (const object of objectsToUpdate)
//     {
//         object.mesh.position.copy(object.body.position)
//         object.mesh.quaternion.copy(object.body.quaternion)
//     }

//     //update mixer
//     if (mixer != null)
//     {
//         mixer.update(deltaTime)
//     }

//     controls.update()
//     renderer.render(scene, camera)
//     window.requestAnimationFrame(tick)
// }

// tick()


// function light() {
//     const ambientLight = new THREE.AmbientLight(0xffffff, 0.7)
//     scene.add(ambientLight)

//     const directionalLight = new THREE.DirectionalLight(0xffffff, 0.2)
//     directionalLight.castShadow = true
//     directionalLight.shadow.mapSize.set(1024, 1024)
//     directionalLight.shadow.camera.far = 15
//     directionalLight.shadow.camera.left = - 7
//     directionalLight.shadow.camera.top = 7
//     directionalLight.shadow.camera.right = 7
//     directionalLight.shadow.camera.bottom = - 7
//     directionalLight.position.set(5, 5, 5)
//     scene.add(directionalLight)

//     const directionalLightCameraHelper = new THREE.CameraHelper(directionalLight.shadow.camera)
//     directionalLightCameraHelper.visible = false
//     gui.add(directionalLightCameraHelper, 'visible').name('directionalLight - Helper')
//     scene.add(directionalLightCameraHelper)
// }

// function setupPhysics() {

// }

// function generateFloor() {
//     //---three.js---
//     const floor = new THREE.Mesh(
//         new THREE.PlaneGeometry(30, 30),
//         new THREE.MeshStandardMaterial({
//             color: '#777777',
//             metalness: 0.3,
//             roughness: 0.4,
//             envMap: environmentMapTexture,
//             envMapIntensity: 0.5
//         })
//     )
//     floor.receiveShadow = true
//     floor.rotation.x = - Math.PI * 0.5
//     scene.add(floor)

//     //---cannon.js---
//     const floorShape = new CANNON.Plane()
//     const floorBody = new CANNON.Body()
//     floorBody.mass = 0
//     floorBody.addShape(floorShape)
//     floorBody.quaternion.setFromAxisAngle(
//         new CANNON.Vec3(-1, 0, 0),
//         Math.PI * 0.5
//     )
//     world.addBody(floorBody)
// }