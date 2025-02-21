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
        this.gui = new GUI();
        this.loader = new GLTFLoader();
        this.templates = null;
    }

    async init(){

        // Create an anonymous user and obtain the access token required to access the API endpoints
        const data = await this.createAnonymousUser();

        if(data) {
            // Get access token from the response
            TOKEN = data.data.token;
            this.initScene();

            this.templates = await this.getAllTemplates();
            const htmlContainer = document.getElementById("images-container");
            for(let i = 0; i < this.templates.length; i++) {
                const div = document.createElement("div");
                const img = document.createElement("img");
                img.src = this.templates[i].imageUrl;
                img["data-id"] = i;

                div.appendChild(img);
                htmlContainer.appendChild(div);

                div.addEventListener("click", async (event) => {
                    const templateData = this.templates[event.target["data-id"]];
                    const template = await this.assignTemplate(templateData);
                    if(template) {
                        this.loadAvatar(template.id, "preview");
                        htmlContainer.classList.add("hidden");
                    }
                })
                
            }
            htmlContainer.classList.remove("hidden");
        }
        
    }

    // Create an anonymous user for your application to get a token
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

    async assignTemplate(data) {

        const requestOptions = {
            method: "POST",
            body: JSON.stringify({"data":{ "partner": SUBDOMAIN, "bodyType": "fullbody" }}),
            redirect: "follow",
            headers: {"Authorization": 'Bearer '+ TOKEN,
                "content-type": "application/json"
            }
        };

        try {
            const response = await fetch("https://api.readyplayer.me/v2/avatars/templates/"+ data.id, requestOptions);
            const result = await response.json();
            return result.data;
        } catch (error) {
            console.error(error);
        };
    }

    // Get all available assets
    async getAllAssets() { // Documentation: https://docs.readyplayer.me/ready-player-me/api-reference/rest-api/assets/get-list-assets
        const response = await fetch('https://api.readyplayer.me/v1/assets', {method: "GET", headers: {"X-APP-ID": API_ID, "Authorization": 'Bearer '+ TOKEN}});
        try {
            if(response.ok) {
                const data = await response.json(); //obtenim la llista d'assets

                //guardar les imatges dels assets
                if(data && data.data) { 
                    const assets = data.data; 
                    console.log("Lista de assets: ", assets);
                    // Extrae los datos relevantes para las imágenes de cada asset
                    for(const asset of assets) { 
                        console.log(`Nombre del asset: ${asset.name}, Imagen del asset: ${asset.preview}`); 
                    }
                }

                return data;
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

    async applyAsset(assetId) {
        // Aplica l'asset al avatar utilitzant l'API
        const response = await fetch('https://api.readyplayer.me/v1/avatars/67878b01f08d27cfbf7db517/apply', {method: "POST", headers: {"X-APP-ID": API_ID,"Authorization": 'Bearer ' + TOKEN,"Content-Type": "application/json"},
            body: JSON.stringify({ assets: [assetId] }) //envia el ID del asset
        });
    
        if (response.ok) {
            const avatarUrl = await response.json();
            console.log('Asset applied:', avatarUrl);
    
            // Recarga el model ocult amb el nou avatar (model actualitzat)
            this.loader.load(avatarUrl.updatedModelUrl, (gltf) => {
                this.hiddenModel = gltf.scene.clone();
                this.hiddenModel.visible = false; //mantindre ocult
                this.scene.add(this.hiddenModel);
    
                this.render();
            });
        } else {
            console.error('Failed to apply asset:', response.status);
        }
    }

    async changeAssetAndReloadModel(modelId, assetId, modelUrl) {
        const url = `https://api.readyplayer.me/v1/models/${modelId}/assets/${assetId}`;
    
        try {
            const response = await fetch(url, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${TOKEN}`, // Requiere token de autenticación
                    "Content-Type": "application/json",
                    "X-APP-ID": API_ID
                }
            });
            if (response.ok) {
                console.log(`Asset successfully updated in the model ${modelId}`);
                const updatedData = await response.json();
                console.log("Asset actualizado. Recargando modelo...");
                return await this.reloadModel(modelUrl);
            } else {
                console.error(`Error ${response.status}: Failed to update asset.`);
            }
        } catch (error) {
            console.error(`Error making request: ${error}`);
        }
        return null;
    }

    async reloadModel(modelUrl) {
        const loader = new THREE.GLTFLoader();
    
        try {
            const gltf = await loader.loadAsync(modelUrl);
    
            // Elimina el modelo actual de la escena, si existe
            if (this.visibleModel) {
                this.scene.remove(this.visibleModel);
                this.visibleModel = null;
            }
    
            // Añade el nuevo modelo a la escena
            this.visibleModel = gltf.scene;
            this.scene.add(this.visibleModel);
    
            console.log("Modelo recargado con éxito.");
            return gltf.scene; // Devuelve el modelo cargado
        } catch (error) {
            console.error(`Error al recargar el modelo: ${error}`);
        }
    }

    findSkinnedMeshes(model) {
        const skinnedMeshes = {}; // Aquí guardaremos los assets que nos interesen
    
        model.traverse((child) => {
            if (child.isSkinnedMesh) {
                // Clasifica por nombre, ID, o algún criterio propio
                const name = child.name || `mesh_${child.id}`;
                skinnedMeshes[name] = child;
                console.log(`SkinnedMesh encontrado: ${name}`);
            }
        });
    
        return skinnedMeshes;
    }

    async manageModelAssets(modelId, assetId, modelUrl) {
        // Actualiza el asset en la API y recarga el modelo
        const updatedModel = await this.changeAssetAndReloadModel(modelId, assetId, modelUrl);
    
        if (updatedModel) {
            console.log("Buscando SkinnedMeshes en el modelo...");
            const meshes = this.findSkinnedMeshes(updatedModel);
    
            // Guarda las referencias en variables separadas según un criterio
            this.hairMesh = meshes["hair"] || null; // Ejemplo: Nombre debe ser 'hair'
            this.topMesh = meshes["top"] || null;   // Ejemplo: Nombre debe ser 'top'
    
            console.log("Meshes guardados:", { hair: this.hairMesh, top: this.topMesh });
        }
    }

    async initScene(){
        this.scene = new THREE.Scene();
        //this.scene.background = new THREE.Color( 0x1a1a1a );
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

        this.visibleModel = null; // model visible al usuari
        this.hiddenModel = null; // model on s'apliquen els canvis

        this.render();

        this.createSidebar();
    }

    loadAvatar(id, preview) {

        this.loader.load( 'https://api.readyplayer.me/v2/avatars/'+id+'.glb' + (preview ? "?preview=true" : ""), ( gltf ) => {

            //model visible
            if(!this.visibleModel) {
                this.scene.add(gltf.scene);
            }
            this.visibleModel = gltf.scene;
            this.render();
            return true;

        } );
    }

    createSidebar() {
        const sidebar = document.createElement('div');
        sidebar.style.position = 'absolute';
        sidebar.style.right = '0';
        sidebar.style.top = '0';
        sidebar.style.width = '300px';
        sidebar.style.height = '100%';
        sidebar.style.backgroundColor = '#f0f0f0';
        sidebar.style.overflow = 'auto';
        document.body.appendChild(sidebar);
    
        const parts = ["Nose", "Chin", "Ears", "Jaw"];
        parts.forEach(part => {
            let label = document.createElement('label');
            label.innerText = `${part}: `;
            let slider = document.createElement('input');
            slider.type = 'range';
            slider.min = 0;
            slider.max = 1;
            slider.step = 0.01;
            slider.value = 0;
    
            slider.addEventListener('input', (event) => {
                const value = parseFloat(event.target.value);
                app.updateMorphTarget(part, value);
            });
    
            sidebar.appendChild(label);
            sidebar.appendChild(slider);
        });
    }
    

    // Functions for INTERPOLATION between facial characteristics (morph targets)

    /*
    getPart(mesh, part){
        let face_idx = mesh.children.findIndex(obj => obj.name.includes(part));
        if(mesh.name.includes(part)) return mesh
        else if (face_idx == -1){
            let head_idx =mesh.children.findIndex(obj => obj.name.includes("Head"));
            if (head_idx != -1) return this.getPart(mesh.children[head_idx],part);
            return this.getPart(mesh.children[0],part)
        }// body case
        return mesh.children[face_idx]
    }

    addMorph(target ,vertices, code,type,sel_name){

        let morph_idx = this.scene.children.findIndex(obj => obj.name.includes("Blend"));
        let morph = this.scene.children[morph_idx];

        //fn to select face inside the head object 
        morph = this.getPart(morph,"Face");
        let face = morph;

        let source_p = new THREE.Float32BufferAttribute( morph.geometry.attributes.position.array, 3 );
        let source_n = new THREE.Float32BufferAttribute( morph.geometry.attributes.normal.array, 3 );
        let target_p = new THREE.Float32BufferAttribute( target.geometry.attributes.position.array, 3 );

        let name = code + morph.morphPartsInfo[code].length;
        
        if(morph.morphTargetInfluences == undefined) this.initiaizeTargets(morph,name);
        else{ 
            morph.morphTargetDictionary[morph.morphTargetInfluences.length]= name;
            morph.morphTargetInfluences.push(0);
        }
        
        morph.morphPartsInfo[code].push({id : morph.morphTargetInfluences.length, character: sel_name}); //store index of the morph part for the slider to know what morph influence to alter 
        let combined = this.morphArray(source_p,target_p, vertices, type);
        let mixed_p = combined.res;
        let mt_p = new THREE.Float32BufferAttribute( mixed_p, 3 );

        morph.geometry.morphAttributes.position.push(  mt_p );
        morph.geometry.morphAttributes.normal.push(  source_n );  

        morph = this.scene.children[morph_idx];
        let helper_sliders;

        this.scene.remove(morph);
        this.scene.add(morph);
        return {mph: face, helper_sliders: helper_sliders};
    }

    */

    // End of funtions for INTERPOLATION between facial characteristics (morph targets)

    updateRendererSize() {
        const sidebarWidth = this.sidebar ? this.sidebar.offsetWidth : 0;
        this.renderer.setSize(window.innerWidth - sidebarWidth, window.innerHeight);
    }

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize( window.innerWidth, window.innerHeight );
        this.render();

    }

    render() {
        this.renderer.render( this.scene, this.camera );
    }
}

export {App};

const app = new App();
app.init();