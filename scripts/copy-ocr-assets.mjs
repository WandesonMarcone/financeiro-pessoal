import {cp,mkdir} from 'node:fs/promises';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const destination=resolve(root,'public/tesseract');
await mkdir(destination,{recursive:true});

for(const [source,target] of [
 ['node_modules/tesseract.js/dist/worker.min.js','worker.min.js'],
 ['node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js','tesseract-core-lstm.wasm.js'],
 ['node_modules/tesseract.js-core/tesseract-core-lstm.wasm','tesseract-core-lstm.wasm'],
 ['node_modules/@tesseract.js-data/por/4.0.0_best_int/por.traineddata.gz','por.traineddata.gz']
]) await cp(resolve(root,source),resolve(destination,target));
