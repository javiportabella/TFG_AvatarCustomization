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
            // // Get list of assets
            // const assets = await this.getAllAssets();

            // if(assets) {
            //     const list = assets.data;
            //     // Show response at console log
            //     console.log(list);
            //     // Show response at web
            //     //document.getElementById("response").innerText = JSON.stringify(list, undefined, 2);
                
            //     this.initScene();
            //     for(let i = 0; i < list.length; i++) {
            //         if(list[i].modelUrl) {
            //             this.loader.load( list[i].modelUrl, ( gltf ) => {
            //                 console.log(list[i].name);
            //                 this.scene.add( gltf.scene );
                
            //                 this.render();             
            //             } );
            //         }
            //     }
            // }
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
        this.scene.background = new THREE.Color( 0xbbbbbb );

        this.camera = new THREE.PerspectiveCamera( 60, window.innerWidth / window.innerHeight, 0.1, 1000 );
        this.camera.position.set(0, 1.5, 1.5);
        
        this.renderer = new THREE.WebGLRenderer( );
		this.renderer.setPixelRatio( window.devicePixelRatio );
        this.updateRendererSize();
        
        this.controls = new OrbitControls( this.camera, this.renderer.domElement );
        this.controls.addEventListener( 'change', () => this.render() );
        this.controls.target.set( 0, 1, 0 );
        this.controls.update();

        document.body.appendChild(this.renderer.domElement);
        window.addEventListener('resize', () => {
            this.renderer.setSize(window.innerWidth, window.innerHeight);
            this.camera.aspect = window.innerWidth / window.innerHeight;
            this.camera.updateProjectionMatrix();
        });

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambientLight);
        const pointLight = new THREE.PointLight(0xffffff, 1);
        pointLight.position.set(10, 10, 10);
        this.scene.add(pointLight);

        this.visibleModel = null; // model visible al usuari
        this.hiddenModel = null; // model on s'apliquen els canvis

        // await this.loadAvatar("67878b01f08d27cfbf7db517");
        this.render();
        
        /*this.loader.load( 'https://models.readyplayer.me/67878b01f08d27cfbf7db517.glb', ( gltf ) => {
            // Normaliza la escala y otras propiedades antes de clonar
            gltf.scene.scale.set(1, 1, 1);
            gltf.scene.position.set(0, 0, 0);
        
            console.log("Original gltf.scene before cloning:", gltf.scene);
        
            // Modelo visible
            this.visibleModel = this.deepClone(gltf.scene);
            console.log("visibleModel after cloning:", this.visibleModel);
            this.scene.add(this.visibleModel);
        
            // Modelo oculto para aplicar cambios
            this.hiddenModel = this.deepClone(gltf.scene);
            console.log("hiddenModel after cloning:", this.hiddenModel);
            this.hiddenModel.visible = false;
            this.scene.add(this.hiddenModel);
        
            this.render();
        });
        */

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
        this.sidebar = document.createElement('div');
        this.sidebar.style.position = 'absolute';
        this.sidebar.style.right = '0';
        this.sidebar.style.top = '0';
        this.sidebar.style.width = '300px';
        this.sidebar.style.height = '100%';
        this.sidebar.style.backgroundColor = '#f0f0f0';
        this.sidebar.style.overflow = 'auto';
        document.body.appendChild(this.sidebar);
    }

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