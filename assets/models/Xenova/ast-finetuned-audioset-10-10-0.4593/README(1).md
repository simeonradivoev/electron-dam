---
base_model: MIT/ast-finetuned-audioset-10-10-0.4593
library_name: transformers.js
---

https://huggingface.co/MIT/ast-finetuned-audioset-10-10-0.4593 with ONNX weights to be compatible with Transformers.js.


## Usage (Transformers.js)

If you haven't already, you can install the [Transformers.js](https://huggingface.co/docs/transformers.js) JavaScript library from [NPM](https://www.npmjs.com/package/@huggingface/transformers) using:
```bash
npm i @huggingface/transformers
```

**Example:** Perform audio classification with `Xenova/ast-finetuned-audioset-10-10-0.4593` and return top 4 results.
```js
import { pipeline } from '@huggingface/transformers';

// Create an audio classification pipeline
const classifier = await pipeline('audio-classification', 'Xenova/ast-finetuned-audioset-10-10-0.4593');

// Predict class
const url = 'https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/cat_meow.wav';
const output = await classifier(url, { top_k: 4 });
console.log(output);
// [
//   { label: 'Meow', score: 0.5617874264717102 },
//   { label: 'Cat', score: 0.22365376353263855 },
//   { label: 'Domestic animals, pets', score: 0.1141069084405899 },
//   { label: 'Animal', score: 0.08985692262649536 },
// ]
```

---

Note: Having a separate repo for ONNX weights is intended to be a temporary solution until WebML gains more traction. If you would like to make your models web-ready, we recommend converting to ONNX using [🤗 Optimum](https://huggingface.co/docs/optimum/index) and structuring your repo like this one (with ONNX weights located in a subfolder named `onnx`).