import { GUI } from "./gui.js";

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// Follow this tutorial: https://docs.readyplayer.me/ready-player-me/integration-guides/api-integration/quickstart
const SUBDOMAIN = 'oasis'; // your project name
const API_ID = '678787338a474ff75326a320';
let TOKEN = null;

class App {
    constructor(){
        // Initialize properties
        this.gui = new GUI();
        this.loader = new GLTFLoader();
        this.templates = null;
        this.referenceModels = []; // Store reference models for interpolation
        this.verticesData = null; // Store verticesGlobal.json data
        this.preloadAvatarTemplates = [];
        this.debug = false; // Debug mode
    }

    // Initialize the application
    async init(){

        // Create an anonymous user and obtain the access token required to access the API endpoints
        const data = await this.createAnonymousUser();

        if(data) {
            // Get access token from the response
            TOKEN = data.data.token;
            this.initScene();

            this.templates = await this.getAllTemplates();
            this.verticesData = await this.loadVerticesData(); //Load the JSON file with the vertices data
            const htmlContainer = document.getElementById("images-container");
            const urlParams = new URLSearchParams(window.location.search);
            this.debug = urlParams.get("debug");

            for(let i = 0; i < this.templates.length; i++) {
                const div = document.createElement("div");
                const img = document.createElement("img");
                img.src = this.templates[i].imageUrl;
                img["data-id"] = i;

                div.appendChild(img);
                htmlContainer.appendChild(div);

                div.addEventListener("click", async (event) => {
                    // We use the data-id attribute to get the index of the template 
                    // and then we get the template data from the templates array
                    const templateData = this.templates[event.target["data-id"]];
                    const template = await this.assignTemplate(templateData);
                    if(template) {
                        this.loadAvatar(template.id, "preview");
                        htmlContainer.classList.add("hidden");
                    }
                })
                
            }
            htmlContainer.classList.remove("hidden");
            if (this.templates) {
                this.createSidebar();
            } else {
                console.error("Error: Could not load avatar templates.");
            }
        }
        
    }

    // Create an anonymous user to get access token
    async createAnonymousUser() { // Documentation: https://docs.readyplayer.me/ready-player-me/integration-guides/api-integration/quickstart#create-anonymous-user
        const response = await fetch('https://'+ SUBDOMAIN + '.readyplayer.me/api/users', {method: "POST"});
        try {
            if(response.ok) {
                return await response.json();
            }
            else {
                console.error(response.status + ": " + response.statusText);
            }
        }
        catch(error) {
            console.error(error);
        }
        return null;
    }

    // Fetch all available avatar templates
    async getAllTemplates() {
        const response = await fetch("https://api.readyplayer.me/v2/avatars/templates", {method: "GET", headers: {"Authorization": 'Bearer '+ TOKEN}});
        try {
            if(response.ok) {
                const data = await response.json(); //get list of templates
                return data.data;
            }
        }
        catch(err) {
            console.error(err);
        }JSON.stringify({"data":{ "partner": SUBDOMAIN, "bodyType": "fullbody" }})
    }

    // Assign a template to the user, generate a temporary avatar ID
    async assignTemplate(data) {
        if(!this.preloadAvatarTemplates[data.id]) {
            const requestOptions = {
                method: "POST",
                body: JSON.stringify({"data":{ "partner": SUBDOMAIN, "bodyType": "fullbody" }}),
                redirect: "follow",
                headers: {"Authorization": 'Bearer '+ TOKEN,
                    "content-type": "application/json"
                }
            };
    
            try {
                let response = await fetch("https://api.readyplayer.me/v2/avatars/templates/"+ data.id, requestOptions);
                let result = await response.json();
    
                // Create the avatar permanently
                requestOptions.method = "PUT";
                response = await fetch("https://api.readyplayer.me/v2/avatars/"+ result.data.id, requestOptions);
                this.preloadAvatarTemplates[data.id] = {id: result.data.id};
                return result.data;
                
            } catch (error) {
                console.error(error);
            };

        }
        return this.preloadAvatarTemplates[data.id];
    }

    // Load vertices data from external file
    async loadVerticesData() {
        try {
            const response = await fetch("ImportExportVertices/verticesGlobal.json");
            if (!response.ok) throw new Error("Cannot load verticesGlobal.json");
            return await response.json();
        } catch (error) {
            console.error("Error loading verticesGlobal.json:", error);
            return null;
        }
    }

    // Initialize the Three.js scene
    async initScene(){
        this.scene = new THREE.Scene();
        
        // Set background image
        const bgTexture = new THREE.TextureLoader().load('filesUtiles/fondoplaya.avif');
        this.scene.background = bgTexture;

        this.camera = new THREE.PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 0.1, 1000 );
        this.camera.position.set(0.2, 1.5, 0.7);
        
        this.renderer = new THREE.WebGLRenderer( );
		this.renderer.setPixelRatio( window.devicePixelRatio );
        this.updateRendererSize();
        
        this.controls = new OrbitControls( this.camera, this.renderer.domElement );
        this.controls.addEventListener( 'change', () => this.render() );
        this.controls.target.set( 0, 1.5, 0 );
        this.controls.minDistance = .4;
        this.controls.maxDistance = 10;
        this.controls.update();

        document.body.appendChild(this.renderer.domElement);
        window.addEventListener('resize', () => {
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
        });

        const ambientLight = new THREE.AmbientLight(0xffffff, 1);
        this.scene.add(ambientLight);
        const pointLight = new THREE.PointLight(0xffffff, 1);
        pointLight.position.set(10, 10, 10);
        this.scene.add(pointLight);
        let dirLight = new THREE.DirectionalLight ( 0xffffff, 0.5 );
        dirLight.position.set( 3,5,3 );
        this.scene.add( dirLight );

        let ground = new THREE.Mesh( new THREE.PlaneGeometry( 300, 300 ), new THREE.MeshStandardMaterial( { color: 0x141414, depthWrite: true, roughness: 1, metalness: 0 } ) );
        ground.rotation.x = -Math.PI / 2;
        const gridHelper = new THREE.GridHelper( 10, 20, 0xffffff, 0xbbbbbb );
        this.scene.add( gridHelper );

        this.visibleModel = null; // visible model to the user
        this.hiddenModel = null; // model where the changes are applied

        this.render();
    }

    updateRendererSize() {
        const sidebarWidth = this.sidebar ? this.sidebar.offsetWidth : 0;
        this.renderer.setSize(window.innerWidth - sidebarWidth, window.innerHeight);
    }

    render() {
        this.renderer.render( this.scene, this.camera );
    }

    // Create the sidebar UI (with collapsible sections)
    createSidebar() {
        const sidebarContainer = document.createElement('div');
        sidebarContainer.style.position = 'absolute';
        sidebarContainer.style.right = '0';
        sidebarContainer.style.top = '0';
        sidebarContainer.style.width = '300px';
        sidebarContainer.style.height = '100%';
        sidebarContainer.style.backgroundColor = 'rgba(139, 139, 139, 0.7)';
        sidebarContainer.style.overflow = 'auto';
        sidebarContainer.style.padding = '10px';
        sidebarContainer.style.boxShadow = '0px 0px 10px rgba(0,0,0,0.3)';
        document.body.appendChild(sidebarContainer);
    
        // Helper to create collapsible sections
        const createDropdown = (title) => {
            const section = document.createElement('div');
            section.style.marginBottom = '10px';
    
            const header = document.createElement('div');
            header.innerText = title;
            header.style.backgroundColor = 'rgb(16, 70, 120)';
            header.style.color = 'white';
            header.style.padding = '10px';
            header.style.cursor = 'pointer';
            header.style.borderRadius = '5px';
            header.style.textAlign = 'center';
    
            const content = document.createElement('div');
            content.style.display = 'none';
            content.style.padding = '10px';
    
            // Alternate visibility when clicking
            header.addEventListener('click', () => {
                content.style.display = content.style.display === 'none' ? 'block' : 'none';
            });
    
            section.appendChild(header);
            section.appendChild(content);
            sidebarContainer.appendChild(section);
    
            return content;
        };
    
        // ====== INTERPOLATION ======
        const interpolationContent = createDropdown('Interpolation');
    
        // Sliders
        const parts = ["Nose", "Eyes", "Ears", "Jaw", "Chin"];
        parts.forEach(part => {
            let label = document.createElement('label');
            label.innerText = `${part}`;
            label.style.color = 'black';
            label.style.margin = '4%';
    
            let slider = document.createElement('input');
            slider.type = 'range';
            slider.style.width = '100%';
            slider.min = 0;
            slider.max = 1;
            slider.step = 0.01;
            slider.value = 0;
    
            slider.addEventListener('input', (event) => {
                this.updateMorphTarget(part, parseFloat(event.target.value));
            });
    
            interpolationContent.appendChild(label);
            interpolationContent.appendChild(slider);
        });
    
        // Container for reference models
        const referenceContainer = document.createElement('div');
        referenceContainer.style.display = 'grid';
        referenceContainer.style.gridTemplateColumns = 'repeat(3, 1fr)';
        referenceContainer.style.gap = '10px';
        referenceContainer.style.marginTop = '10px';
        interpolationContent.appendChild(referenceContainer);
    
        this.templates.forEach((template, index) => {
            const div = document.createElement("div");
            const img = document.createElement("img");
            img.src = template.imageUrl;
            img.style.width = "100%";
            img.style.height = '80px';
            img.style.objectFit = 'cover';
            img.style.cursor = "pointer";
            img.setAttribute("data-id", index);
    
            img.addEventListener('click', async (event) => {
                const templateData = this.templates[event.target.getAttribute("data-id")];
                const template = await this.assignTemplate(templateData);
                    
                // Check if it already exists in referenceModels
                const alreadyLoaded = this.referenceModels.find(ref => ref.name === template.id);
                if (!alreadyLoaded) {
                    this.selectReferenceModel(template.id);
                } else {
                    console.log(`El modelo ${template.id} ya está cargado como referencia.`);
                }
    
                // Highlight the selected image
                const allImages = referenceContainer.getElementsByTagName('img');
                Array.from(allImages).forEach(image => {
                    image.style.border = '';
                    image.style.borderRadius = '';
                });
    
                img.style.border = '4px solid rgb(16, 70, 120)';
                img.style.borderRadius = '12px';
            });
    
            div.appendChild(img);
            referenceContainer.appendChild(div);
        });
    
        // ====== RECOLORING ======
        const recoloringContent = createDropdown('Recoloring');
        const recoloringText = document.createElement('p');
        recoloringText.innerText = 'Opciones de recoloring aquí...';
        recoloringContent.appendChild(recoloringText);
    
        // ====== WRINKLE MAPS ======
        const wrinkleContent = createDropdown('Wrinkle Maps');
        const wrinkleText = document.createElement('p');
        wrinkleText.innerText = 'Opciones de wrinkle maps aquí...';
        wrinkleContent.appendChild(wrinkleText);
    }

    // Load avatar GLB into the scene
    loadAvatar(id, preview) {
        this.loader.load('https://models.readyplayer.me/'+id+'.glb' + (preview ? "?preview=true" : ""), (gltf) => {
            if(!this.visibleModel) {
                this.scene.add(gltf.scene);
            }
            this.visibleModel = gltf.scene;
            gltf.scene.getObjectByName("Wolf3D_Head").morphPartsInfo = {"Nose":[], "Chin": [], "Ears":[], "Jaw":[], "Eyes":[]}; //store each part which morphattribute it corresponds to 

            if (this.referenceModels.length > 0) {
                this.createMorphTargets(this.referenceModels[0]);
            }
    
            this.render();
            return true;
        });
    }

    // Load a reference model for interpolation
    async selectReferenceModel(modelId) {
        // Prevent loading if already loaded
        const alreadyLoaded = this.referenceModels.find(ref => ref.userData.modelId === modelId);
        if (alreadyLoaded) {
            console.log("Reference model already loaded:", modelId);
            this.createMorphTargets(alreadyLoaded);
            return;
        }
    
        this.loader.load('https://api.readyplayer.me/v2/avatars/' + modelId + '.glb', (gltf) => {
            const referenceModel = gltf.scene;
            referenceModel.userData.modelId = modelId; // Guardamos el ID para evitar duplicados
    
            this.referenceModels.push(referenceModel);
    
            this.createMorphTargets(referenceModel);
    
            console.log("Reference model added:", modelId);
        });
    }

    // Create morph targets using the vertex of the reference model -> to use in loadAvatar() and selectReferenceModel() 
    createMorphTargets(referenceModel) {
        const referenceHead = referenceModel.getObjectByName("Wolf3D_Head");
        const visibleHead = this.visibleModel?.getObjectByName("Wolf3D_Head");
    
        if (!referenceHead || !visibleHead) {
            console.warn("Cannot find 'Wolf3D_Head' meshes to create morph targets.");
            return;
        }
    
        const parts = ["Nose", "Eyes", "Ears", "Jaw", "Chin"];
    
        parts.forEach(part => {
            if (this.verticesData[part]) {
                this.addMorph(
                    referenceHead,
                    this.verticesData[part],
                    part,
                    `Reference_${part}`
                );
            }
        });
    }

    // Initialize morph targets if they do not exist yet
    initializeMorphTargets(headMesh) {
        // Check if the mesh has morph targets and initialize them if not
        if (!headMesh.morphTargetInfluences) {
            headMesh.morphTargetInfluences = [];
            headMesh.morphTargetDictionary = {};
            
            const parts = ["Nose", "Eyes", "Ears", "Jaw", "Chin"];
            parts.forEach(part => {
                if (!headMesh.morphTargetDictionary[part]) {
                    headMesh.morphTargetDictionary[part] = headMesh.morphTargetInfluences.length;
                    headMesh.morphTargetInfluences.push(0);
                }
            });
            
            if (!headMesh.geometry.morphAttributes) {
                headMesh.geometry.morphAttributes = {
                    position: [],
                    normal: []
                };
            }
        }
    }

    // Update morph target influences for a facial part
    updateMorphTarget(part, value) {
        if (!this.verticesData || !this.verticesData[part]) {
            console.warn(`No vertices data for ${part}`);
            return;
        }
        
        let morphMesh = this.visibleModel.getObjectByName("Wolf3D_Head");
        if (!morphMesh) {
            console.warn(`'Wolf3D_Head' not found`);
            return;
        }

        if (morphMesh.morphTargetInfluences === undefined) {
            this.initializeMorphTargets(morphMesh);
        }


        const morphIndex = morphMesh.morphTargetDictionary[part + "0"];
        morphMesh.morphTargetInfluences[morphIndex] = value;

        morphMesh.geometry.attributes.position.needsUpdate = true;
        morphMesh.geometry.computeVertexNormals();

        this.render();
    } 

    // Add a new morph target to the head mesh
    addMorph(target, vertices, code, sel_name){
        const morph = this.scene.getObjectByName("Wolf3D_Head");

        // Get base attributes
        const sourceAttr = morph.geometry.attributes.position;
        const targetAttr = target.geometry.attributes.position;

        const stride = sourceAttr.data.stride;

        // Generate new morphed array from source + target at selected vertices
        const { res: delta_p } = this.morphArray(sourceAttr, targetAttr, vertices, stride);

        let name = code + morph.morphPartsInfo[code].length;
        
        if (!morph.morphTargetInfluences) this.initializeMorphTargets(morph, name);
        morph.morphTargetDictionary[name] = morph.morphTargetInfluences.length;
        morph.morphTargetInfluences.push(0);

        // Store the info about which part this morph belongs to
        morph.morphPartsInfo[code].push({ id: morph.morphTargetInfluences.length - 1, character: sel_name });

        // Create a new Float32BufferAttribute for the interpolated positions
        const mt_p = new THREE.InterleavedBufferAttribute(new THREE.InterleavedBuffer(delta_p,stride), 3, 0);
        
        // Add the newly generated morph target
        morph.geometry.morphAttributes.position.push(mt_p);

        //const mt_n = new THREE.InterleavedBufferAttribute(new THREE.InterleavedBuffer(new Float32Array(delta_p.length).fill(0),stride), 3, 0);
        //morph.geometry.morphAttributes.normal.push(mt_n); //We do not need to add the normals, as we are working with InterleavedBufferAttributes and there is no need to recalculate them


        // debug
        if (this.debug) {
            let geometry = new THREE.BufferGeometry();
            geometry.setAttribute( 'position', morph.geometry.attributes.position);
            console.log("Morph:", morph.geometry.getIndex());
            geometry.setIndex(morph.geometry.getIndex());
            let material = new THREE.MeshStandardMaterial( { color: "green", wireframe: true } );
            let mesh = new THREE.Mesh( geometry, material );
            mesh.position.x = 0.5;
            mesh.name = "source";
            this.scene.add(mesh);
    
            const geometry_t = new THREE.BufferGeometry();
            geometry_t.setAttribute( 'position', target.geometry.attributes.position);
            console.log("Target:", target.geometry.getIndex());
            geometry_t.setIndex(target.geometry.getIndex());
    
            const material_t = new THREE.MeshStandardMaterial( { color: "red", wireframe: true } );
            mesh = new THREE.Mesh( geometry_t, material_t );
            mesh.position.x = 0.8;
            mesh.name = "target";
            this.scene.add(mesh);
    
            const geometry_r = new THREE.BufferGeometry();
            geometry_r.setAttribute( 'position', mt_p);
            geometry_r.setIndex(morph.geometry.getIndex());
            const material_r = new THREE.MeshStandardMaterial( { color: "blue", wireframe: true } );
            mesh = new THREE.Mesh( geometry_r, material_r );
            mesh.position.x = 0.5;
            mesh.name = "result";
            this.scene.add(mesh);
        }

        return {mph: morph, helper_sliders: null};
    }

    // Compute the center of a vertex array
    // This function is used to calculate the center of the vertices in the geometry to obtain the relative position of the morph targets
    computeCenter(array, stride) {
        const center = new THREE.Vector3();
        const count = array.length / stride;
    
        for (let i = 0; i < array.length; i += stride) {
            center.x += array[i];
            center.y += array[i + 1];
            center.z += array[i + 2];
        }
        center.divideScalar(count);
        return center;
    }
    

    // Generate a morph array combining source and target vertices
    morphArray(source, target, vertices, stride) {
        const sourceArray = source.array;
        const targetArray = target.array;
        const count = source.count; // Number of vertices in the geometry
    
        const deltaArray = new Float32Array(count * stride).fill(0);

        // Compute the center of the source and target arrays as a reference point
        const sourceCenter = this.computeCenter(sourceArray, stride);
        const targetCenter = this.computeCenter(targetArray, stride);
    
        for (const indexArray of Object.values(vertices)) {
            for (const index of indexArray) {
                const i = index * stride; // Calculate the offset for the vertex
                
                // POSICIÓN (relativa al centro)
                const sx = sourceArray[i]     - sourceCenter.x;
                const sy = sourceArray[i + 1] - sourceCenter.y;
                const sz = sourceArray[i + 2] - sourceCenter.z;

                const tx = targetArray[i]     - targetCenter.x;
                const ty = targetArray[i + 1] - targetCenter.y;
                const tz = targetArray[i + 2] - targetCenter.z;

                deltaArray[i]     = tx - sx;
                deltaArray[i + 1] = ty - sy;
                deltaArray[i + 2] = tz - sz;

                // RESTO DEL STRIDE: diferencia directa
                for (let j = 3; j < stride; j++) {
                    deltaArray[i + j] = targetArray[i + j] - sourceArray[i + j];
                }
            }
        }
    
        return { res: deltaArray, dis: null };
    }    

}

export {App};

const app = new App();
app.init();