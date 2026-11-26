/* Loads the Blender models. They are Draco-compressed, and the decoder is served from public/draco/. */
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";

let loader = null;
export function modelLoader() {
  if (!loader) {
    const draco = new DRACOLoader().setDecoderPath(`${import.meta.env.BASE_URL}draco/`);
    loader = new GLTFLoader().setDRACOLoader(draco);
  }
  return loader;
}
