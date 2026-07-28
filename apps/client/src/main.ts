import { createSceneApp } from './scene/SceneApp';

const container = document.getElementById('app');
if (!container) throw new Error('missing #app container');

const app = createSceneApp();
app.mount(container);
app.start();
