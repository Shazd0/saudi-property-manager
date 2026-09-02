const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./pushNotificationService-CScQq7DN.js","./logo-BJJW74Um.js","./logo-CtbXRfBh.css"])))=>i.map(i=>d[i]);
import{_ as Lt}from"./logo-BJJW74Um.js";const jw=()=>{};var df={};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Pp=function(n){const e=[];let t=0;for(let r=0;r<n.length;r++){let s=n.charCodeAt(r);s<128?e[t++]=s:s<2048?(e[t++]=s>>6|192,e[t++]=s&63|128):(s&64512)===55296&&r+1<n.length&&(n.charCodeAt(r+1)&64512)===56320?(s=65536+((s&1023)<<10)+(n.charCodeAt(++r)&1023),e[t++]=s>>18|240,e[t++]=s>>12&63|128,e[t++]=s>>6&63|128,e[t++]=s&63|128):(e[t++]=s>>12|224,e[t++]=s>>6&63|128,e[t++]=s&63|128)}return e},Gw=function(n){const e=[];let t=0,r=0;for(;t<n.length;){const s=n[t++];if(s<128)e[r++]=String.fromCharCode(s);else if(s>191&&s<224){const i=n[t++];e[r++]=String.fromCharCode((s&31)<<6|i&63)}else if(s>239&&s<365){const i=n[t++],o=n[t++],a=n[t++],u=((s&7)<<18|(i&63)<<12|(o&63)<<6|a&63)-65536;e[r++]=String.fromCharCode(55296+(u>>10)),e[r++]=String.fromCharCode(56320+(u&1023))}else{const i=n[t++],o=n[t++];e[r++]=String.fromCharCode((s&15)<<12|(i&63)<<6|o&63)}}return e.join("")},kp={byteToCharMap_:null,charToByteMap_:null,byteToCharMapWebSafe_:null,charToByteMapWebSafe_:null,ENCODED_VALS_BASE:"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",get ENCODED_VALS(){return this.ENCODED_VALS_BASE+"+/="},get ENCODED_VALS_WEBSAFE(){return this.ENCODED_VALS_BASE+"-_."},HAS_NATIVE_SUPPORT:typeof atob=="function",encodeByteArray(n,e){if(!Array.isArray(n))throw Error("encodeByteArray takes an array as a parameter");this.init_();const t=e?this.byteToCharMapWebSafe_:this.byteToCharMap_,r=[];for(let s=0;s<n.length;s+=3){const i=n[s],o=s+1<n.length,a=o?n[s+1]:0,u=s+2<n.length,l=u?n[s+2]:0,h=i>>2,f=(i&3)<<4|a>>4;let p=(a&15)<<2|l>>6,_=l&63;u||(_=64,o||(p=64)),r.push(t[h],t[f],t[p],t[_])}return r.join("")},encodeString(n,e){return this.HAS_NATIVE_SUPPORT&&!e?btoa(n):this.encodeByteArray(Pp(n),e)},decodeString(n,e){return this.HAS_NATIVE_SUPPORT&&!e?atob(n):Gw(this.decodeStringToByteArray(n,e))},decodeStringToByteArray(n,e){this.init_();const t=e?this.charToByteMapWebSafe_:this.charToByteMap_,r=[];for(let s=0;s<n.length;){const i=t[n.charAt(s++)],a=s<n.length?t[n.charAt(s)]:0;++s;const l=s<n.length?t[n.charAt(s)]:64;++s;const f=s<n.length?t[n.charAt(s)]:64;if(++s,i==null||a==null||l==null||f==null)throw new zw;const p=i<<2|a>>4;if(r.push(p),l!==64){const _=a<<4&240|l>>2;if(r.push(_),f!==64){const w=l<<6&192|f;r.push(w)}}}return r},init_(){if(!this.byteToCharMap_){this.byteToCharMap_={},this.charToByteMap_={},this.byteToCharMapWebSafe_={},this.charToByteMapWebSafe_={};for(let n=0;n<this.ENCODED_VALS.length;n++)this.byteToCharMap_[n]=this.ENCODED_VALS.charAt(n),this.charToByteMap_[this.byteToCharMap_[n]]=n,this.byteToCharMapWebSafe_[n]=this.ENCODED_VALS_WEBSAFE.charAt(n),this.charToByteMapWebSafe_[this.byteToCharMapWebSafe_[n]]=n,n>=this.ENCODED_VALS_BASE.length&&(this.charToByteMap_[this.ENCODED_VALS_WEBSAFE.charAt(n)]=n,this.charToByteMapWebSafe_[this.ENCODED_VALS.charAt(n)]=n)}}};class zw extends Error{constructor(){super(...arguments),this.name="DecodeBase64StringError"}}const Kw=function(n){const e=Pp(n);return kp.encodeByteArray(e,!0)},sc=function(n){return Kw(n).replace(/\./g,"")},Cp=function(n){try{return kp.decodeString(n,!0)}catch(e){console.error("base64Decode failed: ",e)}return null};/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Np(){if(typeof self<"u")return self;if(typeof window<"u")return window;if(typeof global<"u")return global;throw new Error("Unable to locate global object.")}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Ww=()=>Np().__FIREBASE_DEFAULTS__,Hw=()=>{if(typeof process>"u"||typeof df>"u")return;const n=df.__FIREBASE_DEFAULTS__;if(n)return JSON.parse(n)},Qw=()=>{if(typeof document>"u")return;let n;try{n=document.cookie.match(/__FIREBASE_DEFAULTS__=([^;]+)/)}catch{return}const e=n&&Cp(n[1]);return e&&JSON.parse(e)},Nc=()=>{try{return jw()||Ww()||Hw()||Qw()}catch(n){console.info(`Unable to get __FIREBASE_DEFAULTS__ due to: ${n}`);return}},Dp=n=>{var e,t;return(t=(e=Nc())==null?void 0:e.emulatorHosts)==null?void 0:t[n]},Vp=n=>{const e=Dp(n);if(!e)return;const t=e.lastIndexOf(":");if(t<=0||t+1===e.length)throw new Error(`Invalid host ${e} with no separate hostname and port!`);const r=parseInt(e.substring(t+1),10);return e[0]==="["?[e.substring(1,t-1),r]:[e.substring(0,t),r]},Op=()=>{var n;return(n=Nc())==null?void 0:n.config},xp=n=>{var e;return(e=Nc())==null?void 0:e[`_${n}`]};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Jw{constructor(){this.reject=()=>{},this.resolve=()=>{},this.promise=new Promise((e,t)=>{this.resolve=e,this.reject=t})}wrapCallback(e){return(t,r)=>{t?this.reject(t):this.resolve(r),typeof e=="function"&&(this.promise.catch(()=>{}),e.length===1?e(t):e(t,r))}}}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Mp(n,e){if(n.uid)throw new Error('The "uid" field is no longer supported by mockUserToken. Please use "sub" instead for Firebase Auth User ID.');const t={alg:"none",type:"JWT"},r=e||"demo-project",s=n.iat||0,i=n.sub||n.user_id;if(!i)throw new Error("mockUserToken must contain 'sub' or 'user_id' field!");const o={iss:`https://securetoken.google.com/${r}`,aud:r,iat:s,exp:s+3600,auth_time:s,sub:i,user_id:i,firebase:{sign_in_provider:"custom",identities:{}},...n};return[sc(JSON.stringify(t)),sc(JSON.stringify(o)),""].join(".")}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Ye(){return typeof navigator<"u"&&typeof navigator.userAgent=="string"?navigator.userAgent:""}function Yw(){return typeof window<"u"&&!!(window.cordova||window.phonegap||window.PhoneGap)&&/ios|iphone|ipod|ipad|android|blackberry|iemobile/i.test(Ye())}function Lp(){var e;const n=(e=Nc())==null?void 0:e.forceEnvironment;if(n==="node")return!0;if(n==="browser")return!1;try{return Object.prototype.toString.call(global.process)==="[object process]"}catch{return!1}}function Xw(){return typeof navigator<"u"&&navigator.userAgent==="Cloudflare-Workers"}function Zw(){const n=typeof chrome=="object"?chrome.runtime:typeof browser=="object"?browser.runtime:void 0;return typeof n=="object"&&n.id!==void 0}function eE(){return typeof navigator=="object"&&navigator.product==="ReactNative"}function tE(){const n=Ye();return n.indexOf("MSIE ")>=0||n.indexOf("Trident/")>=0}function Bp(){return!Lp()&&!!navigator.userAgent&&navigator.userAgent.includes("Safari")&&!navigator.userAgent.includes("Chrome")}function Fp(){return!Lp()&&!!navigator.userAgent&&(navigator.userAgent.includes("Safari")||navigator.userAgent.includes("WebKit"))&&!navigator.userAgent.includes("Chrome")}function Up(){try{return typeof indexedDB=="object"}catch{return!1}}function nE(){return new Promise((n,e)=>{try{let t=!0;const r="validate-browser-context-for-indexeddb-analytics-module",s=self.indexedDB.open(r);s.onsuccess=()=>{s.result.close(),t||self.indexedDB.deleteDatabase(r),n(!0)},s.onupgradeneeded=()=>{t=!1},s.onerror=()=>{var i;e(((i=s.error)==null?void 0:i.message)||"")}}catch(t){e(t)}})}function C0(){return!(typeof navigator>"u"||!navigator.cookieEnabled)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const rE="FirebaseError";class un extends Error{constructor(e,t,r){super(t),this.code=e,this.customData=r,this.name=rE,Object.setPrototypeOf(this,un.prototype),Error.captureStackTrace&&Error.captureStackTrace(this,Qo.prototype.create)}}class Qo{constructor(e,t,r){this.service=e,this.serviceName=t,this.errors=r}create(e,...t){const r=t[0]||{},s=`${this.service}/${e}`,i=this.errors[e],o=i?sE(i,r):"Error",a=`${this.serviceName}: ${o} (${s}).`;return new un(s,a,r)}}function sE(n,e){return n.replace(iE,(t,r)=>{const s=e[r];return s!=null?String(s):`<${r}?>`})}const iE=/\{\$([^}]+)}/g;function oE(n){for(const e in n)if(Object.prototype.hasOwnProperty.call(n,e))return!1;return!0}function Bt(n,e){if(n===e)return!0;const t=Object.keys(n),r=Object.keys(e);for(const s of t){if(!r.includes(s))return!1;const i=n[s],o=e[s];if(ff(i)&&ff(o)){if(!Bt(i,o))return!1}else if(i!==o)return!1}for(const s of r)if(!t.includes(s))return!1;return!0}function ff(n){return n!==null&&typeof n=="object"}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Jo(n){const e=[];for(const[t,r]of Object.entries(n))Array.isArray(r)?r.forEach(s=>{e.push(encodeURIComponent(t)+"="+encodeURIComponent(s))}):e.push(encodeURIComponent(t)+"="+encodeURIComponent(r));return e.length?"&"+e.join("&"):""}function co(n){const e={};return n.replace(/^\?/,"").split("&").forEach(r=>{if(r){const[s,i]=r.split("=");e[decodeURIComponent(s)]=decodeURIComponent(i)}}),e}function uo(n){const e=n.indexOf("?");if(!e)return"";const t=n.indexOf("#",e);return n.substring(e,t>0?t:void 0)}function aE(n,e){const t=new cE(n,e);return t.subscribe.bind(t)}class cE{constructor(e,t){this.observers=[],this.unsubscribes=[],this.observerCount=0,this.task=Promise.resolve(),this.finalized=!1,this.onNoObservers=t,this.task.then(()=>{e(this)}).catch(r=>{this.error(r)})}next(e){this.forEachObserver(t=>{t.next(e)})}error(e){this.forEachObserver(t=>{t.error(e)}),this.close(e)}complete(){this.forEachObserver(e=>{e.complete()}),this.close()}subscribe(e,t,r){let s;if(e===void 0&&t===void 0&&r===void 0)throw new Error("Missing Observer.");uE(e,["next","error","complete"])?s=e:s={next:e,error:t,complete:r},s.next===void 0&&(s.next=Du),s.error===void 0&&(s.error=Du),s.complete===void 0&&(s.complete=Du);const i=this.unsubscribeOne.bind(this,this.observers.length);return this.finalized&&this.task.then(()=>{try{this.finalError?s.error(this.finalError):s.complete()}catch{}}),this.observers.push(s),i}unsubscribeOne(e){this.observers===void 0||this.observers[e]===void 0||(delete this.observers[e],this.observerCount-=1,this.observerCount===0&&this.onNoObservers!==void 0&&this.onNoObservers(this))}forEachObserver(e){if(!this.finalized)for(let t=0;t<this.observers.length;t++)this.sendOne(t,e)}sendOne(e,t){this.task.then(()=>{if(this.observers!==void 0&&this.observers[e]!==void 0)try{t(this.observers[e])}catch(r){typeof console<"u"&&console.error&&console.error(r)}})}close(e){this.finalized||(this.finalized=!0,e!==void 0&&(this.finalError=e),this.task.then(()=>{this.observers=void 0,this.onNoObservers=void 0}))}}function uE(n,e){if(typeof n!="object"||n===null)return!1;for(const t of e)if(t in n&&typeof n[t]=="function")return!0;return!1}function Du(){}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function ge(n){return n&&n._delegate?n._delegate:n}/**
 * @license
 * Copyright 2025 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function gr(n){try{return(n.startsWith("http://")||n.startsWith("https://")?new URL(n).hostname:n).endsWith(".cloudworkstations.dev")}catch{return!1}}async function Dc(n){return(await fetch(n,{credentials:"include"})).ok}class ar{constructor(e,t,r){this.name=e,this.instanceFactory=t,this.type=r,this.multipleInstances=!1,this.serviceProps={},this.instantiationMode="LAZY",this.onInstanceCreated=null}setInstantiationMode(e){return this.instantiationMode=e,this}setMultipleInstances(e){return this.multipleInstances=e,this}setServiceProps(e){return this.serviceProps=e,this}setInstanceCreatedCallback(e){return this.onInstanceCreated=e,this}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const xr="[DEFAULT]";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class lE{constructor(e,t){this.name=e,this.container=t,this.component=null,this.instances=new Map,this.instancesDeferred=new Map,this.instancesOptions=new Map,this.onInitCallbacks=new Map}get(e){const t=this.normalizeInstanceIdentifier(e);if(!this.instancesDeferred.has(t)){const r=new Jw;if(this.instancesDeferred.set(t,r),this.isInitialized(t)||this.shouldAutoInitialize())try{const s=this.getOrInitializeService({instanceIdentifier:t});s&&r.resolve(s)}catch{}}return this.instancesDeferred.get(t).promise}getImmediate(e){const t=this.normalizeInstanceIdentifier(e==null?void 0:e.identifier),r=(e==null?void 0:e.optional)??!1;if(this.isInitialized(t)||this.shouldAutoInitialize())try{return this.getOrInitializeService({instanceIdentifier:t})}catch(s){if(r)return null;throw s}else{if(r)return null;throw Error(`Service ${this.name} is not available`)}}getComponent(){return this.component}setComponent(e){if(e.name!==this.name)throw Error(`Mismatching Component ${e.name} for Provider ${this.name}.`);if(this.component)throw Error(`Component for ${this.name} has already been provided`);if(this.component=e,!!this.shouldAutoInitialize()){if(dE(e))try{this.getOrInitializeService({instanceIdentifier:xr})}catch{}for(const[t,r]of this.instancesDeferred.entries()){const s=this.normalizeInstanceIdentifier(t);try{const i=this.getOrInitializeService({instanceIdentifier:s});r.resolve(i)}catch{}}}}clearInstance(e=xr){this.instancesDeferred.delete(e),this.instancesOptions.delete(e),this.instances.delete(e)}async delete(){const e=Array.from(this.instances.values());await Promise.all([...e.filter(t=>"INTERNAL"in t).map(t=>t.INTERNAL.delete()),...e.filter(t=>"_delete"in t).map(t=>t._delete())])}isComponentSet(){return this.component!=null}isInitialized(e=xr){return this.instances.has(e)}getOptions(e=xr){return this.instancesOptions.get(e)||{}}initialize(e={}){const{options:t={}}=e,r=this.normalizeInstanceIdentifier(e.instanceIdentifier);if(this.isInitialized(r))throw Error(`${this.name}(${r}) has already been initialized`);if(!this.isComponentSet())throw Error(`Component ${this.name} has not been registered yet`);const s=this.getOrInitializeService({instanceIdentifier:r,options:t});for(const[i,o]of this.instancesDeferred.entries()){const a=this.normalizeInstanceIdentifier(i);r===a&&o.resolve(s)}return s}onInit(e,t){const r=this.normalizeInstanceIdentifier(t),s=this.onInitCallbacks.get(r)??new Set;s.add(e),this.onInitCallbacks.set(r,s);const i=this.instances.get(r);return i&&e(i,r),()=>{s.delete(e)}}invokeOnInitCallbacks(e,t){const r=this.onInitCallbacks.get(t);if(r)for(const s of r)try{s(e,t)}catch{}}getOrInitializeService({instanceIdentifier:e,options:t={}}){let r=this.instances.get(e);if(!r&&this.component&&(r=this.component.instanceFactory(this.container,{instanceIdentifier:hE(e),options:t}),this.instances.set(e,r),this.instancesOptions.set(e,t),this.invokeOnInitCallbacks(r,e),this.component.onInstanceCreated))try{this.component.onInstanceCreated(this.container,e,r)}catch{}return r||null}normalizeInstanceIdentifier(e=xr){return this.component?this.component.multipleInstances?e:xr:e}shouldAutoInitialize(){return!!this.component&&this.component.instantiationMode!=="EXPLICIT"}}function hE(n){return n===xr?void 0:n}function dE(n){return n.instantiationMode==="EAGER"}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class fE{constructor(e){this.name=e,this.providers=new Map}addComponent(e){const t=this.getProvider(e.name);if(t.isComponentSet())throw new Error(`Component ${e.name} has already been registered with ${this.name}`);t.setComponent(e)}addOrOverwriteComponent(e){this.getProvider(e.name).isComponentSet()&&this.providers.delete(e.name),this.addComponent(e)}getProvider(e){if(this.providers.has(e))return this.providers.get(e);const t=new lE(e,this);return this.providers.set(e,t),t}getProviders(){return Array.from(this.providers.values())}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var ce;(function(n){n[n.DEBUG=0]="DEBUG",n[n.VERBOSE=1]="VERBOSE",n[n.INFO=2]="INFO",n[n.WARN=3]="WARN",n[n.ERROR=4]="ERROR",n[n.SILENT=5]="SILENT"})(ce||(ce={}));const mE={debug:ce.DEBUG,verbose:ce.VERBOSE,info:ce.INFO,warn:ce.WARN,error:ce.ERROR,silent:ce.SILENT},pE=ce.INFO,gE={[ce.DEBUG]:"log",[ce.VERBOSE]:"log",[ce.INFO]:"info",[ce.WARN]:"warn",[ce.ERROR]:"error"},_E=(n,e,...t)=>{if(e<n.logLevel)return;const r=new Date().toISOString(),s=gE[e];if(s)console[s](`[${r}]  ${n.name}:`,...t);else throw new Error(`Attempted to log a message with an invalid logType (value: ${e})`)};class jl{constructor(e){this.name=e,this._logLevel=pE,this._logHandler=_E,this._userLogHandler=null}get logLevel(){return this._logLevel}set logLevel(e){if(!(e in ce))throw new TypeError(`Invalid value "${e}" assigned to \`logLevel\``);this._logLevel=e}setLogLevel(e){this._logLevel=typeof e=="string"?mE[e]:e}get logHandler(){return this._logHandler}set logHandler(e){if(typeof e!="function")throw new TypeError("Value assigned to `logHandler` must be a function");this._logHandler=e}get userLogHandler(){return this._userLogHandler}set userLogHandler(e){this._userLogHandler=e}debug(...e){this._userLogHandler&&this._userLogHandler(this,ce.DEBUG,...e),this._logHandler(this,ce.DEBUG,...e)}log(...e){this._userLogHandler&&this._userLogHandler(this,ce.VERBOSE,...e),this._logHandler(this,ce.VERBOSE,...e)}info(...e){this._userLogHandler&&this._userLogHandler(this,ce.INFO,...e),this._logHandler(this,ce.INFO,...e)}warn(...e){this._userLogHandler&&this._userLogHandler(this,ce.WARN,...e),this._logHandler(this,ce.WARN,...e)}error(...e){this._userLogHandler&&this._userLogHandler(this,ce.ERROR,...e),this._logHandler(this,ce.ERROR,...e)}}const yE=(n,e)=>e.some(t=>n instanceof t);let mf,pf;function IE(){return mf||(mf=[IDBDatabase,IDBObjectStore,IDBIndex,IDBCursor,IDBTransaction])}function wE(){return pf||(pf=[IDBCursor.prototype.advance,IDBCursor.prototype.continue,IDBCursor.prototype.continuePrimaryKey])}const $p=new WeakMap,el=new WeakMap,qp=new WeakMap,Vu=new WeakMap,Gl=new WeakMap;function EE(n){const e=new Promise((t,r)=>{const s=()=>{n.removeEventListener("success",i),n.removeEventListener("error",o)},i=()=>{t(gn(n.result)),s()},o=()=>{r(n.error),s()};n.addEventListener("success",i),n.addEventListener("error",o)});return e.then(t=>{t instanceof IDBCursor&&$p.set(t,n)}).catch(()=>{}),Gl.set(e,n),e}function TE(n){if(el.has(n))return;const e=new Promise((t,r)=>{const s=()=>{n.removeEventListener("complete",i),n.removeEventListener("error",o),n.removeEventListener("abort",o)},i=()=>{t(),s()},o=()=>{r(n.error||new DOMException("AbortError","AbortError")),s()};n.addEventListener("complete",i),n.addEventListener("error",o),n.addEventListener("abort",o)});el.set(n,e)}let tl={get(n,e,t){if(n instanceof IDBTransaction){if(e==="done")return el.get(n);if(e==="objectStoreNames")return n.objectStoreNames||qp.get(n);if(e==="store")return t.objectStoreNames[1]?void 0:t.objectStore(t.objectStoreNames[0])}return gn(n[e])},set(n,e,t){return n[e]=t,!0},has(n,e){return n instanceof IDBTransaction&&(e==="done"||e==="store")?!0:e in n}};function AE(n){tl=n(tl)}function vE(n){return n===IDBDatabase.prototype.transaction&&!("objectStoreNames"in IDBTransaction.prototype)?function(e,...t){const r=n.call(Ou(this),e,...t);return qp.set(r,e.sort?e.sort():[e]),gn(r)}:wE().includes(n)?function(...e){return n.apply(Ou(this),e),gn($p.get(this))}:function(...e){return gn(n.apply(Ou(this),e))}}function bE(n){return typeof n=="function"?vE(n):(n instanceof IDBTransaction&&TE(n),yE(n,IE())?new Proxy(n,tl):n)}function gn(n){if(n instanceof IDBRequest)return EE(n);if(Vu.has(n))return Vu.get(n);const e=bE(n);return e!==n&&(Vu.set(n,e),Gl.set(e,n)),e}const Ou=n=>Gl.get(n);function SE(n,e,{blocked:t,upgrade:r,blocking:s,terminated:i}={}){const o=indexedDB.open(n,e),a=gn(o);return r&&o.addEventListener("upgradeneeded",u=>{r(gn(o.result),u.oldVersion,u.newVersion,gn(o.transaction),u)}),t&&o.addEventListener("blocked",u=>t(u.oldVersion,u.newVersion,u)),a.then(u=>{i&&u.addEventListener("close",()=>i()),s&&u.addEventListener("versionchange",l=>s(l.oldVersion,l.newVersion,l))}).catch(()=>{}),a}function N0(n,{blocked:e}={}){const t=indexedDB.deleteDatabase(n);return e&&t.addEventListener("blocked",r=>e(r.oldVersion,r)),gn(t).then(()=>{})}const RE=["get","getKey","getAll","getAllKeys","count"],PE=["put","add","delete","clear"],xu=new Map;function gf(n,e){if(!(n instanceof IDBDatabase&&!(e in n)&&typeof e=="string"))return;if(xu.get(e))return xu.get(e);const t=e.replace(/FromIndex$/,""),r=e!==t,s=PE.includes(t);if(!(t in(r?IDBIndex:IDBObjectStore).prototype)||!(s||RE.includes(t)))return;const i=async function(o,...a){const u=this.transaction(o,s?"readwrite":"readonly");let l=u.store;return r&&(l=l.index(a.shift())),(await Promise.all([l[t](...a),s&&u.done]))[0]};return xu.set(e,i),i}AE(n=>({...n,get:(e,t,r)=>gf(e,t)||n.get(e,t,r),has:(e,t)=>!!gf(e,t)||n.has(e,t)}));/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class kE{constructor(e){this.container=e}getPlatformInfoString(){return this.container.getProviders().map(t=>{if(CE(t)){const r=t.getImmediate();return`${r.library}/${r.version}`}else return null}).filter(t=>t).join(" ")}}function CE(n){const e=n.getComponent();return(e==null?void 0:e.type)==="VERSION"}const nl="@firebase/app",_f="0.14.13";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const _n=new jl("@firebase/app"),NE="@firebase/app-compat",DE="@firebase/analytics-compat",VE="@firebase/analytics",OE="@firebase/app-check-compat",xE="@firebase/app-check",ME="@firebase/auth",LE="@firebase/auth-compat",BE="@firebase/database",FE="@firebase/data-connect",UE="@firebase/database-compat",$E="@firebase/functions",qE="@firebase/functions-compat",jE="@firebase/installations",GE="@firebase/installations-compat",zE="@firebase/messaging",KE="@firebase/messaging-compat",WE="@firebase/performance",HE="@firebase/performance-compat",QE="@firebase/remote-config",JE="@firebase/remote-config-compat",YE="@firebase/storage",XE="@firebase/storage-compat",ZE="@firebase/firestore",eT="@firebase/ai",tT="@firebase/firestore-compat",nT="firebase",rT="12.14.0";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const ic="[DEFAULT]",sT={[nl]:"fire-core",[NE]:"fire-core-compat",[VE]:"fire-analytics",[DE]:"fire-analytics-compat",[xE]:"fire-app-check",[OE]:"fire-app-check-compat",[ME]:"fire-auth",[LE]:"fire-auth-compat",[BE]:"fire-rtdb",[FE]:"fire-data-connect",[UE]:"fire-rtdb-compat",[$E]:"fire-fn",[qE]:"fire-fn-compat",[jE]:"fire-iid",[GE]:"fire-iid-compat",[zE]:"fire-fcm",[KE]:"fire-fcm-compat",[WE]:"fire-perf",[HE]:"fire-perf-compat",[QE]:"fire-rc",[JE]:"fire-rc-compat",[YE]:"fire-gcs",[XE]:"fire-gcs-compat",[ZE]:"fire-fst",[tT]:"fire-fst-compat",[eT]:"fire-vertex","fire-js":"fire-js",[nT]:"fire-js-all"};/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Ro=new Map,iT=new Map,rl=new Map;function yf(n,e){try{n.container.addComponent(e)}catch(t){_n.debug(`Component ${e.name} failed to register with FirebaseApp ${n.name}`,t)}}function Wr(n){const e=n.name;if(rl.has(e))return _n.debug(`There were multiple attempts to register component ${e}.`),!1;rl.set(e,n);for(const t of Ro.values())yf(t,n);for(const t of iT.values())yf(t,n);return!0}function fi(n,e){const t=n.container.getProvider("heartbeat").getImmediate({optional:!0});return t&&t.triggerHeartbeat(),n.container.getProvider(e)}function oT(n,e,t=ic){fi(n,e).clearInstance(t)}function Ct(n){return n==null?!1:n.settings!==void 0}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const aT={"no-app":"No Firebase App '{$appName}' has been created - call initializeApp() first","bad-app-name":"Illegal App name: '{$appName}'","duplicate-app":"Firebase App named '{$appName}' already exists with different options or config","app-deleted":"Firebase App named '{$appName}' already deleted","server-app-deleted":"Firebase Server App has been deleted","no-options":"Need to provide options, when not being deployed to hosting via source.","invalid-app-argument":"firebase.{$appName}() takes either no argument or a Firebase App instance.","invalid-log-argument":"First argument to `onLog` must be null or a function.","idb-open":"Error thrown when opening IndexedDB. Original error: {$originalErrorMessage}.","idb-get":"Error thrown when reading from IndexedDB. Original error: {$originalErrorMessage}.","idb-set":"Error thrown when writing to IndexedDB. Original error: {$originalErrorMessage}.","idb-delete":"Error thrown when deleting from IndexedDB. Original error: {$originalErrorMessage}.","finalization-registry-not-supported":"FirebaseServerApp deleteOnDeref field defined but the JS runtime does not support FinalizationRegistry.","invalid-server-app-environment":"FirebaseServerApp is not for use in browser environments."},rr=new Qo("app","Firebase",aT);/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class cT{constructor(e,t,r){this._isDeleted=!1,this._options={...e},this._config={...t},this._name=t.name,this._automaticDataCollectionEnabled=t.automaticDataCollectionEnabled,this._container=r,this.container.addComponent(new ar("app",()=>this,"PUBLIC"))}get automaticDataCollectionEnabled(){return this.checkDestroyed(),this._automaticDataCollectionEnabled}set automaticDataCollectionEnabled(e){this.checkDestroyed(),this._automaticDataCollectionEnabled=e}get name(){return this.checkDestroyed(),this._name}get options(){return this.checkDestroyed(),this._options}get config(){return this.checkDestroyed(),this._config}get container(){return this._container}get isDeleted(){return this._isDeleted}set isDeleted(e){this._isDeleted=e}checkDestroyed(){if(this.isDeleted)throw rr.create("app-deleted",{appName:this._name})}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const as=rT;function jp(n,e={}){let t=n;typeof e!="object"&&(e={name:e});const r={name:ic,automaticDataCollectionEnabled:!0,...e},s=r.name;if(typeof s!="string"||!s)throw rr.create("bad-app-name",{appName:String(s)});if(t||(t=Op()),!t)throw rr.create("no-options");const i=Ro.get(s);if(i){if(Bt(t,i.options)&&Bt(r,i.config))return i;throw rr.create("duplicate-app",{appName:s})}const o=new fE(s);for(const u of rl.values())o.addComponent(u);const a=new cT(t,r,o);return Ro.set(s,a),a}function Vc(n=ic){const e=Ro.get(n);if(!e&&n===ic&&Op())return jp();if(!e)throw rr.create("no-app",{appName:n});return e}function uT(){return Array.from(Ro.values())}function Xt(n,e,t){let r=sT[n]??n;t&&(r+=`-${t}`);const s=r.match(/\s|\//),i=e.match(/\s|\//);if(s||i){const o=[`Unable to register library "${r}" with version "${e}":`];s&&o.push(`library name "${r}" contains illegal characters (whitespace or "/")`),s&&i&&o.push("and"),i&&o.push(`version name "${e}" contains illegal characters (whitespace or "/")`),_n.warn(o.join(" "));return}Wr(new ar(`${r}-version`,()=>({library:r,version:e}),"VERSION"))}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const lT="firebase-heartbeat-database",hT=1,Po="firebase-heartbeat-store";let Mu=null;function Gp(){return Mu||(Mu=SE(lT,hT,{upgrade:(n,e)=>{switch(e){case 0:try{n.createObjectStore(Po)}catch(t){console.warn(t)}}}}).catch(n=>{throw rr.create("idb-open",{originalErrorMessage:n.message})})),Mu}async function dT(n){try{const t=(await Gp()).transaction(Po),r=await t.objectStore(Po).get(zp(n));return await t.done,r}catch(e){if(e instanceof un)_n.warn(e.message);else{const t=rr.create("idb-get",{originalErrorMessage:e==null?void 0:e.message});_n.warn(t.message)}}}async function If(n,e){try{const r=(await Gp()).transaction(Po,"readwrite");await r.objectStore(Po).put(e,zp(n)),await r.done}catch(t){if(t instanceof un)_n.warn(t.message);else{const r=rr.create("idb-set",{originalErrorMessage:t==null?void 0:t.message});_n.warn(r.message)}}}function zp(n){return`${n.name}!${n.options.appId}`}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const fT=1024,mT=30;class pT{constructor(e){this.container=e,this._heartbeatsCache=null;const t=this.container.getProvider("app").getImmediate();this._storage=new _T(t),this._heartbeatsCachePromise=this._storage.read().then(r=>(this._heartbeatsCache=r,r))}async triggerHeartbeat(){var e,t;try{const s=this.container.getProvider("platform-logger").getImmediate().getPlatformInfoString(),i=wf();if(((e=this._heartbeatsCache)==null?void 0:e.heartbeats)==null&&(this._heartbeatsCache=await this._heartbeatsCachePromise,((t=this._heartbeatsCache)==null?void 0:t.heartbeats)==null)||this._heartbeatsCache.lastSentHeartbeatDate===i||this._heartbeatsCache.heartbeats.some(o=>o.date===i))return;if(this._heartbeatsCache.heartbeats.push({date:i,agent:s}),this._heartbeatsCache.heartbeats.length>mT){const o=yT(this._heartbeatsCache.heartbeats);this._heartbeatsCache.heartbeats.splice(o,1)}return this._storage.overwrite(this._heartbeatsCache)}catch(r){_n.warn(r)}}async getHeartbeatsHeader(){var e;try{if(this._heartbeatsCache===null&&await this._heartbeatsCachePromise,((e=this._heartbeatsCache)==null?void 0:e.heartbeats)==null||this._heartbeatsCache.heartbeats.length===0)return"";const t=wf(),{heartbeatsToSend:r,unsentEntries:s}=gT(this._heartbeatsCache.heartbeats),i=sc(JSON.stringify({version:2,heartbeats:r}));return this._heartbeatsCache.lastSentHeartbeatDate=t,s.length>0?(this._heartbeatsCache.heartbeats=s,await this._storage.overwrite(this._heartbeatsCache)):(this._heartbeatsCache.heartbeats=[],this._storage.overwrite(this._heartbeatsCache)),i}catch(t){return _n.warn(t),""}}}function wf(){return new Date().toISOString().substring(0,10)}function gT(n,e=fT){const t=[];let r=n.slice();for(const s of n){const i=t.find(o=>o.agent===s.agent);if(i){if(i.dates.push(s.date),Ef(t)>e){i.dates.pop();break}}else if(t.push({agent:s.agent,dates:[s.date]}),Ef(t)>e){t.pop();break}r=r.slice(1)}return{heartbeatsToSend:t,unsentEntries:r}}class _T{constructor(e){this.app=e,this._canUseIndexedDBPromise=this.runIndexedDBEnvironmentCheck()}async runIndexedDBEnvironmentCheck(){return Up()?nE().then(()=>!0).catch(()=>!1):!1}async read(){if(await this._canUseIndexedDBPromise){const t=await dT(this.app);return t!=null&&t.heartbeats?t:{heartbeats:[]}}else return{heartbeats:[]}}async overwrite(e){if(await this._canUseIndexedDBPromise){const r=await this.read();return If(this.app,{lastSentHeartbeatDate:e.lastSentHeartbeatDate??r.lastSentHeartbeatDate,heartbeats:e.heartbeats})}else return}async add(e){if(await this._canUseIndexedDBPromise){const r=await this.read();return If(this.app,{lastSentHeartbeatDate:e.lastSentHeartbeatDate??r.lastSentHeartbeatDate,heartbeats:[...r.heartbeats,...e.heartbeats]})}else return}}function Ef(n){return sc(JSON.stringify({version:2,heartbeats:n})).length}function yT(n){if(n.length===0)return-1;let e=0,t=n[0].date;for(let r=1;r<n.length;r++)n[r].date<t&&(t=n[r].date,e=r);return e}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function IT(n){Wr(new ar("platform-logger",e=>new kE(e),"PRIVATE")),Wr(new ar("heartbeat",e=>new pT(e),"PRIVATE")),Xt(nl,_f,n),Xt(nl,_f,"esm2020"),Xt("fire-js","")}IT("");function Kp(){return{"dependent-sdk-initialized-before-auth":"Another Firebase SDK was initialized and is trying to use Auth before Auth is initialized. Please be sure to call `initializeAuth` or `getAuth` before starting any other Firebase SDK."}}const wT=Kp,Wp=new Qo("auth","Firebase",Kp());/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const oc=new jl("@firebase/auth");function ET(n,...e){oc.logLevel<=ce.WARN&&oc.warn(`Auth (${as}): ${n}`,...e)}function $a(n,...e){oc.logLevel<=ce.ERROR&&oc.error(`Auth (${as}): ${n}`,...e)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Ft(n,...e){throw zl(n,...e)}function Zt(n,...e){return zl(n,...e)}function Hp(n,e,t){const r={...wT(),[e]:t};return new Qo("auth","Firebase",r).create(e,{appName:n.name})}function sr(n){return Hp(n,"operation-not-supported-in-this-environment","Operations that alter the current user are not supported in conjunction with FirebaseServerApp")}function zl(n,...e){if(typeof n!="string"){const t=e[0],r=[...e.slice(1)];return r[0]&&(r[0].appName=n.name),n._errorFactory.create(t,...r)}return Wp.create(n,...e)}function ee(n,e,...t){if(!n)throw zl(e,...t)}function mn(n){const e="INTERNAL ASSERTION FAILED: "+n;throw $a(e),new Error(e)}function yn(n,e){n||mn(e)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function sl(){var n;return typeof self<"u"&&((n=self.location)==null?void 0:n.href)||""}function TT(){return Tf()==="http:"||Tf()==="https:"}function Tf(){var n;return typeof self<"u"&&((n=self.location)==null?void 0:n.protocol)||null}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function AT(){return typeof navigator<"u"&&navigator&&"onLine"in navigator&&typeof navigator.onLine=="boolean"&&(TT()||Zw()||"connection"in navigator)?navigator.onLine:!0}function vT(){if(typeof navigator>"u")return null;const n=navigator;return n.languages&&n.languages[0]||n.language||null}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Yo{constructor(e,t){this.shortDelay=e,this.longDelay=t,yn(t>e,"Short delay should be less than long delay!"),this.isMobile=Yw()||eE()}get(){return AT()?this.isMobile?this.longDelay:this.shortDelay:Math.min(5e3,this.shortDelay)}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Kl(n,e){yn(n.emulator,"Emulator should always be set here");const{url:t}=n.emulator;return e?`${t}${e.startsWith("/")?e.slice(1):e}`:t}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Qp{static initialize(e,t,r){this.fetchImpl=e,t&&(this.headersImpl=t),r&&(this.responseImpl=r)}static fetch(){if(this.fetchImpl)return this.fetchImpl;if(typeof self<"u"&&"fetch"in self)return self.fetch;if(typeof globalThis<"u"&&globalThis.fetch)return globalThis.fetch;if(typeof fetch<"u")return fetch;mn("Could not find fetch implementation, make sure you call FetchProvider.initialize() with an appropriate polyfill")}static headers(){if(this.headersImpl)return this.headersImpl;if(typeof self<"u"&&"Headers"in self)return self.Headers;if(typeof globalThis<"u"&&globalThis.Headers)return globalThis.Headers;if(typeof Headers<"u")return Headers;mn("Could not find Headers implementation, make sure you call FetchProvider.initialize() with an appropriate polyfill")}static response(){if(this.responseImpl)return this.responseImpl;if(typeof self<"u"&&"Response"in self)return self.Response;if(typeof globalThis<"u"&&globalThis.Response)return globalThis.Response;if(typeof Response<"u")return Response;mn("Could not find Response implementation, make sure you call FetchProvider.initialize() with an appropriate polyfill")}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const bT={CREDENTIAL_MISMATCH:"custom-token-mismatch",MISSING_CUSTOM_TOKEN:"internal-error",INVALID_IDENTIFIER:"invalid-email",MISSING_CONTINUE_URI:"internal-error",INVALID_PASSWORD:"wrong-password",MISSING_PASSWORD:"missing-password",INVALID_LOGIN_CREDENTIALS:"invalid-credential",EMAIL_EXISTS:"email-already-in-use",PASSWORD_LOGIN_DISABLED:"operation-not-allowed",INVALID_IDP_RESPONSE:"invalid-credential",INVALID_PENDING_TOKEN:"invalid-credential",FEDERATED_USER_ID_ALREADY_LINKED:"credential-already-in-use",MISSING_REQ_TYPE:"internal-error",EMAIL_NOT_FOUND:"user-not-found",RESET_PASSWORD_EXCEED_LIMIT:"too-many-requests",EXPIRED_OOB_CODE:"expired-action-code",INVALID_OOB_CODE:"invalid-action-code",MISSING_OOB_CODE:"internal-error",CREDENTIAL_TOO_OLD_LOGIN_AGAIN:"requires-recent-login",INVALID_ID_TOKEN:"invalid-user-token",TOKEN_EXPIRED:"user-token-expired",USER_NOT_FOUND:"user-token-expired",TOO_MANY_ATTEMPTS_TRY_LATER:"too-many-requests",PASSWORD_DOES_NOT_MEET_REQUIREMENTS:"password-does-not-meet-requirements",INVALID_CODE:"invalid-verification-code",INVALID_SESSION_INFO:"invalid-verification-id",INVALID_TEMPORARY_PROOF:"invalid-credential",MISSING_SESSION_INFO:"missing-verification-id",SESSION_EXPIRED:"code-expired",MISSING_ANDROID_PACKAGE_NAME:"missing-android-pkg-name",UNAUTHORIZED_DOMAIN:"unauthorized-continue-uri",INVALID_OAUTH_CLIENT_ID:"invalid-oauth-client-id",ADMIN_ONLY_OPERATION:"admin-restricted-operation",INVALID_MFA_PENDING_CREDENTIAL:"invalid-multi-factor-session",MFA_ENROLLMENT_NOT_FOUND:"multi-factor-info-not-found",MISSING_MFA_ENROLLMENT_ID:"missing-multi-factor-info",MISSING_MFA_PENDING_CREDENTIAL:"missing-multi-factor-session",SECOND_FACTOR_EXISTS:"second-factor-already-in-use",SECOND_FACTOR_LIMIT_EXCEEDED:"maximum-second-factor-count-exceeded",BLOCKING_FUNCTION_ERROR_RESPONSE:"internal-error",RECAPTCHA_NOT_ENABLED:"recaptcha-not-enabled",MISSING_RECAPTCHA_TOKEN:"missing-recaptcha-token",INVALID_RECAPTCHA_TOKEN:"invalid-recaptcha-token",INVALID_RECAPTCHA_ACTION:"invalid-recaptcha-action",MISSING_CLIENT_TYPE:"missing-client-type",MISSING_RECAPTCHA_VERSION:"missing-recaptcha-version",INVALID_RECAPTCHA_VERSION:"invalid-recaptcha-version",INVALID_REQ_TYPE:"invalid-req-type"};/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const ST=["/v1/accounts:signInWithCustomToken","/v1/accounts:signInWithEmailLink","/v1/accounts:signInWithIdp","/v1/accounts:signInWithPassword","/v1/accounts:signInWithPhoneNumber","/v1/token"],RT=new Yo(3e4,6e4);function _r(n,e){return n.tenantId&&!e.tenantId?{...e,tenantId:n.tenantId}:e}async function vn(n,e,t,r,s={}){return Jp(n,s,async()=>{let i={},o={};r&&(e==="GET"?o=r:i={body:JSON.stringify(r)});const a=Jo({key:n.config.apiKey,...o}).slice(1),u=await n._getAdditionalHeaders();u["Content-Type"]="application/json",n.languageCode&&(u["X-Firebase-Locale"]=n.languageCode);const l={method:e,headers:u,...i};return Xw()||(l.referrerPolicy="no-referrer"),n.emulatorConfig&&gr(n.emulatorConfig.host)&&(l.credentials="include"),Qp.fetch()(await Yp(n,n.config.apiHost,t,a),l)})}async function Jp(n,e,t){n._canInitEmulator=!1;const r={...bT,...e};try{const s=new kT(n),i=await Promise.race([t(),s.promise]);s.clearNetworkTimeout();const o=await i.json();if("needConfirmation"in o)throw ka(n,"account-exists-with-different-credential",o);if(i.ok&&!("errorMessage"in o))return o;{const a=i.ok?o.errorMessage:o.error.message,[u,l]=a.split(" : ");if(u==="FEDERATED_USER_ID_ALREADY_LINKED")throw ka(n,"credential-already-in-use",o);if(u==="EMAIL_EXISTS")throw ka(n,"email-already-in-use",o);if(u==="USER_DISABLED")throw ka(n,"user-disabled",o);const h=r[u]||u.toLowerCase().replace(/[_\s]+/g,"-");if(l)throw Hp(n,h,l);Ft(n,h)}}catch(s){if(s instanceof un)throw s;Ft(n,"network-request-failed",{message:String(s)})}}async function Oc(n,e,t,r,s={}){const i=await vn(n,e,t,r,s);return"mfaPendingCredential"in i&&Ft(n,"multi-factor-auth-required",{_serverResponse:i}),i}async function Yp(n,e,t,r){const s=`${e}${t}?${r}`,i=n,o=i.config.emulator?Kl(n.config,s):`${n.config.apiScheme}://${s}`;return ST.includes(t)&&(await i._persistenceManagerAvailable,i._getPersistenceType()==="COOKIE")?i._getPersistence()._getFinalTarget(o).toString():o}function PT(n){switch(n){case"ENFORCE":return"ENFORCE";case"AUDIT":return"AUDIT";case"OFF":return"OFF";default:return"ENFORCEMENT_STATE_UNSPECIFIED"}}class kT{clearNetworkTimeout(){clearTimeout(this.timer)}constructor(e){this.auth=e,this.timer=null,this.promise=new Promise((t,r)=>{this.timer=setTimeout(()=>r(Zt(this.auth,"network-request-failed")),RT.get())})}}function ka(n,e,t){const r={appName:n.name};t.email&&(r.email=t.email),t.phoneNumber&&(r.phoneNumber=t.phoneNumber);const s=Zt(n,e,r);return s.customData._tokenResponse=t,s}function Af(n){return n!==void 0&&n.enterprise!==void 0}class CT{constructor(e){if(this.siteKey="",this.recaptchaEnforcementState=[],e.recaptchaKey===void 0)throw new Error("recaptchaKey undefined");this.siteKey=e.recaptchaKey.split("/")[3],this.recaptchaEnforcementState=e.recaptchaEnforcementState}getProviderEnforcementState(e){if(!this.recaptchaEnforcementState||this.recaptchaEnforcementState.length===0)return null;for(const t of this.recaptchaEnforcementState)if(t.provider&&t.provider===e)return PT(t.enforcementState);return null}isProviderEnabled(e){return this.getProviderEnforcementState(e)==="ENFORCE"||this.getProviderEnforcementState(e)==="AUDIT"}isAnyProviderEnabled(){return this.isProviderEnabled("EMAIL_PASSWORD_PROVIDER")||this.isProviderEnabled("PHONE_PROVIDER")}}async function NT(n,e){return vn(n,"GET","/v2/recaptchaConfig",_r(n,e))}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function DT(n,e){return vn(n,"POST","/v1/accounts:delete",e)}async function ac(n,e){return vn(n,"POST","/v1/accounts:lookup",e)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function po(n){if(n)try{const e=new Date(Number(n));if(!isNaN(e.getTime()))return e.toUTCString()}catch{}}async function VT(n,e=!1){const t=ge(n),r=await t.getIdToken(e),s=Wl(r);ee(s&&s.exp&&s.auth_time&&s.iat,t.auth,"internal-error");const i=typeof s.firebase=="object"?s.firebase:void 0,o=i==null?void 0:i.sign_in_provider;return{claims:s,token:r,authTime:po(Lu(s.auth_time)),issuedAtTime:po(Lu(s.iat)),expirationTime:po(Lu(s.exp)),signInProvider:o||null,signInSecondFactor:(i==null?void 0:i.sign_in_second_factor)||null}}function Lu(n){return Number(n)*1e3}function Wl(n){const[e,t,r]=n.split(".");if(e===void 0||t===void 0||r===void 0)return $a("JWT malformed, contained fewer than 3 sections"),null;try{const s=Cp(t);return s?JSON.parse(s):($a("Failed to decode base64 JWT payload"),null)}catch(s){return $a("Caught error parsing JWT payload as JSON",s==null?void 0:s.toString()),null}}function vf(n){const e=Wl(n);return ee(e,"internal-error"),ee(typeof e.exp<"u","internal-error"),ee(typeof e.iat<"u","internal-error"),Number(e.exp)-Number(e.iat)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function ko(n,e,t=!1){if(t)return e;try{return await e}catch(r){throw r instanceof un&&OT(r)&&n.auth.currentUser===n&&await n.auth.signOut(),r}}function OT({code:n}){return n==="auth/user-disabled"||n==="auth/user-token-expired"}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class xT{constructor(e){this.user=e,this.isRunning=!1,this.timerId=null,this.errorBackoff=3e4}_start(){this.isRunning||(this.isRunning=!0,this.schedule())}_stop(){this.isRunning&&(this.isRunning=!1,this.timerId!==null&&clearTimeout(this.timerId))}getInterval(e){if(e){const t=this.errorBackoff;return this.errorBackoff=Math.min(this.errorBackoff*2,96e4),t}else{this.errorBackoff=3e4;const r=(this.user.stsTokenManager.expirationTime??0)-Date.now()-3e5;return Math.max(0,r)}}schedule(e=!1){if(!this.isRunning)return;const t=this.getInterval(e);this.timerId=setTimeout(async()=>{await this.iteration()},t)}async iteration(){try{await this.user.getIdToken(!0)}catch(e){(e==null?void 0:e.code)==="auth/network-request-failed"&&this.schedule(!0);return}this.schedule()}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class il{constructor(e,t){this.createdAt=e,this.lastLoginAt=t,this._initializeTime()}_initializeTime(){this.lastSignInTime=po(this.lastLoginAt),this.creationTime=po(this.createdAt)}_copy(e){this.createdAt=e.createdAt,this.lastLoginAt=e.lastLoginAt,this._initializeTime()}toJSON(){return{createdAt:this.createdAt,lastLoginAt:this.lastLoginAt}}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function cc(n){var f;const e=n.auth,t=await n.getIdToken(),r=await ko(n,ac(e,{idToken:t}));ee(r==null?void 0:r.users.length,e,"internal-error");const s=r.users[0];n._notifyReloadListener(s);const i=(f=s.providerUserInfo)!=null&&f.length?Xp(s.providerUserInfo):[],o=LT(n.providerData,i),a=n.isAnonymous,u=!(n.email&&s.passwordHash)&&!(o!=null&&o.length),l=a?u:!1,h={uid:s.localId,displayName:s.displayName||null,photoURL:s.photoUrl||null,email:s.email||null,emailVerified:s.emailVerified||!1,phoneNumber:s.phoneNumber||null,tenantId:s.tenantId||null,providerData:o,metadata:new il(s.createdAt,s.lastLoginAt),isAnonymous:l};Object.assign(n,h)}async function MT(n){const e=ge(n);await cc(e),await e.auth._persistUserIfCurrent(e),e.auth._notifyListenersIfCurrent(e)}function LT(n,e){return[...n.filter(r=>!e.some(s=>s.providerId===r.providerId)),...e]}function Xp(n){return n.map(({providerId:e,...t})=>({providerId:e,uid:t.rawId||"",displayName:t.displayName||null,email:t.email||null,phoneNumber:t.phoneNumber||null,photoURL:t.photoUrl||null}))}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function BT(n,e){const t=await Jp(n,{},async()=>{const r=Jo({grant_type:"refresh_token",refresh_token:e}).slice(1),{tokenApiHost:s,apiKey:i}=n.config,o=await Yp(n,s,"/v1/token",`key=${i}`),a=await n._getAdditionalHeaders();a["Content-Type"]="application/x-www-form-urlencoded";const u={method:"POST",headers:a,body:r};return n.emulatorConfig&&gr(n.emulatorConfig.host)&&(u.credentials="include"),Qp.fetch()(o,u)});return{accessToken:t.access_token,expiresIn:t.expires_in,refreshToken:t.refresh_token}}async function FT(n,e){return vn(n,"POST","/v2/accounts:revokeToken",_r(n,e))}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class xs{constructor(){this.refreshToken=null,this.accessToken=null,this.expirationTime=null}get isExpired(){return!this.expirationTime||Date.now()>this.expirationTime-3e4}updateFromServerResponse(e){ee(e.idToken,"internal-error"),ee(typeof e.idToken<"u","internal-error"),ee(typeof e.refreshToken<"u","internal-error");const t="expiresIn"in e&&typeof e.expiresIn<"u"?Number(e.expiresIn):vf(e.idToken);this.updateTokensAndExpiration(e.idToken,e.refreshToken,t)}updateFromIdToken(e){ee(e.length!==0,"internal-error");const t=vf(e);this.updateTokensAndExpiration(e,null,t)}async getToken(e,t=!1){return!t&&this.accessToken&&!this.isExpired?this.accessToken:(ee(this.refreshToken,e,"user-token-expired"),this.refreshToken?(await this.refresh(e,this.refreshToken),this.accessToken):null)}clearRefreshToken(){this.refreshToken=null}async refresh(e,t){const{accessToken:r,refreshToken:s,expiresIn:i}=await BT(e,t);this.updateTokensAndExpiration(r,s,Number(i))}updateTokensAndExpiration(e,t,r){this.refreshToken=t||null,this.accessToken=e||null,this.expirationTime=Date.now()+r*1e3}static fromJSON(e,t){const{refreshToken:r,accessToken:s,expirationTime:i}=t,o=new xs;return r&&(ee(typeof r=="string","internal-error",{appName:e}),o.refreshToken=r),s&&(ee(typeof s=="string","internal-error",{appName:e}),o.accessToken=s),i&&(ee(typeof i=="number","internal-error",{appName:e}),o.expirationTime=i),o}toJSON(){return{refreshToken:this.refreshToken,accessToken:this.accessToken,expirationTime:this.expirationTime}}_assign(e){this.accessToken=e.accessToken,this.refreshToken=e.refreshToken,this.expirationTime=e.expirationTime}_clone(){return Object.assign(new xs,this.toJSON())}_performRefresh(){return mn("not implemented")}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function $n(n,e){ee(typeof n=="string"||typeof n>"u","internal-error",{appName:e})}class Mt{constructor({uid:e,auth:t,stsTokenManager:r,...s}){this.providerId="firebase",this.proactiveRefresh=new xT(this),this.reloadUserInfo=null,this.reloadListener=null,this.uid=e,this.auth=t,this.stsTokenManager=r,this.accessToken=r.accessToken,this.displayName=s.displayName||null,this.email=s.email||null,this.emailVerified=s.emailVerified||!1,this.phoneNumber=s.phoneNumber||null,this.photoURL=s.photoURL||null,this.isAnonymous=s.isAnonymous||!1,this.tenantId=s.tenantId||null,this.providerData=s.providerData?[...s.providerData]:[],this.metadata=new il(s.createdAt||void 0,s.lastLoginAt||void 0)}async getIdToken(e){const t=await ko(this,this.stsTokenManager.getToken(this.auth,e));return ee(t,this.auth,"internal-error"),this.accessToken!==t&&(this.accessToken=t,await this.auth._persistUserIfCurrent(this),this.auth._notifyListenersIfCurrent(this)),t}getIdTokenResult(e){return VT(this,e)}reload(){return MT(this)}_assign(e){this!==e&&(ee(this.uid===e.uid,this.auth,"internal-error"),this.displayName=e.displayName,this.photoURL=e.photoURL,this.email=e.email,this.emailVerified=e.emailVerified,this.phoneNumber=e.phoneNumber,this.isAnonymous=e.isAnonymous,this.tenantId=e.tenantId,this.providerData=e.providerData.map(t=>({...t})),this.metadata._copy(e.metadata),this.stsTokenManager._assign(e.stsTokenManager))}_clone(e){const t=new Mt({...this,auth:e,stsTokenManager:this.stsTokenManager._clone()});return t.metadata._copy(this.metadata),t}_onReload(e){ee(!this.reloadListener,this.auth,"internal-error"),this.reloadListener=e,this.reloadUserInfo&&(this._notifyReloadListener(this.reloadUserInfo),this.reloadUserInfo=null)}_notifyReloadListener(e){this.reloadListener?this.reloadListener(e):this.reloadUserInfo=e}_startProactiveRefresh(){this.proactiveRefresh._start()}_stopProactiveRefresh(){this.proactiveRefresh._stop()}async _updateTokensIfNecessary(e,t=!1){let r=!1;e.idToken&&e.idToken!==this.stsTokenManager.accessToken&&(this.stsTokenManager.updateFromServerResponse(e),r=!0),t&&await cc(this),await this.auth._persistUserIfCurrent(this),r&&this.auth._notifyListenersIfCurrent(this)}async delete(){if(Ct(this.auth.app))return Promise.reject(sr(this.auth));const e=await this.getIdToken();return await ko(this,DT(this.auth,{idToken:e})),this.stsTokenManager.clearRefreshToken(),this.auth.signOut()}toJSON(){return{uid:this.uid,email:this.email||void 0,emailVerified:this.emailVerified,displayName:this.displayName||void 0,isAnonymous:this.isAnonymous,photoURL:this.photoURL||void 0,phoneNumber:this.phoneNumber||void 0,tenantId:this.tenantId||void 0,providerData:this.providerData.map(e=>({...e})),stsTokenManager:this.stsTokenManager.toJSON(),_redirectEventId:this._redirectEventId,...this.metadata.toJSON(),apiKey:this.auth.config.apiKey,appName:this.auth.name}}get refreshToken(){return this.stsTokenManager.refreshToken||""}static _fromJSON(e,t){const r=t.displayName??void 0,s=t.email??void 0,i=t.phoneNumber??void 0,o=t.photoURL??void 0,a=t.tenantId??void 0,u=t._redirectEventId??void 0,l=t.createdAt??void 0,h=t.lastLoginAt??void 0,{uid:f,emailVerified:p,isAnonymous:_,providerData:w,stsTokenManager:b}=t;ee(f&&b,e,"internal-error");const C=xs.fromJSON(this.name,b);ee(typeof f=="string",e,"internal-error"),$n(r,e.name),$n(s,e.name),ee(typeof p=="boolean",e,"internal-error"),ee(typeof _=="boolean",e,"internal-error"),$n(i,e.name),$n(o,e.name),$n(a,e.name),$n(u,e.name),$n(l,e.name),$n(h,e.name);const V=new Mt({uid:f,auth:e,email:s,emailVerified:p,displayName:r,isAnonymous:_,photoURL:o,phoneNumber:i,tenantId:a,stsTokenManager:C,createdAt:l,lastLoginAt:h});return w&&Array.isArray(w)&&(V.providerData=w.map(O=>({...O}))),u&&(V._redirectEventId=u),V}static async _fromIdTokenResponse(e,t,r=!1){const s=new xs;s.updateFromServerResponse(t);const i=new Mt({uid:t.localId,auth:e,stsTokenManager:s,isAnonymous:r});return await cc(i),i}static async _fromGetAccountInfoResponse(e,t,r){const s=t.users[0];ee(s.localId!==void 0,"internal-error");const i=s.providerUserInfo!==void 0?Xp(s.providerUserInfo):[],o=!(s.email&&s.passwordHash)&&!(i!=null&&i.length),a=new xs;a.updateFromIdToken(r);const u=new Mt({uid:s.localId,auth:e,stsTokenManager:a,isAnonymous:o}),l={uid:s.localId,displayName:s.displayName||null,photoURL:s.photoUrl||null,email:s.email||null,emailVerified:s.emailVerified||!1,phoneNumber:s.phoneNumber||null,tenantId:s.tenantId||null,providerData:i,metadata:new il(s.createdAt,s.lastLoginAt),isAnonymous:!(s.email&&s.passwordHash)&&!(i!=null&&i.length)};return Object.assign(u,l),u}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const bf=new Map;function pn(n){yn(n instanceof Function,"Expected a class definition");let e=bf.get(n);return e?(yn(e instanceof n,"Instance stored in cache mismatched with class"),e):(e=new n,bf.set(n,e),e)}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Zp{constructor(){this.type="NONE",this.storage={}}async _isAvailable(){return!0}async _set(e,t){this.storage[e]=t}async _get(e){const t=this.storage[e];return t===void 0?null:t}async _remove(e){delete this.storage[e]}_addListener(e,t){}_removeListener(e,t){}}Zp.type="NONE";const Sf=Zp;/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function qa(n,e,t){return`firebase:${n}:${e}:${t}`}class Ms{constructor(e,t,r){this.persistence=e,this.auth=t,this.userKey=r;const{config:s,name:i}=this.auth;this.fullUserKey=qa(this.userKey,s.apiKey,i),this.fullPersistenceKey=qa("persistence",s.apiKey,i),this.boundEventHandler=t._onStorageEvent.bind(t),this.persistence._addListener(this.fullUserKey,this.boundEventHandler)}setCurrentUser(e){return this.persistence._set(this.fullUserKey,e.toJSON())}async getCurrentUser(){const e=await this.persistence._get(this.fullUserKey);if(!e)return null;if(typeof e=="string"){const t=await ac(this.auth,{idToken:e}).catch(()=>{});return t?Mt._fromGetAccountInfoResponse(this.auth,t,e):null}return Mt._fromJSON(this.auth,e)}removeCurrentUser(){return this.persistence._remove(this.fullUserKey)}savePersistenceForRedirect(){return this.persistence._set(this.fullPersistenceKey,this.persistence.type)}async setPersistence(e){if(this.persistence===e)return;const t=await this.getCurrentUser();if(await this.removeCurrentUser(),this.persistence=e,t)return this.setCurrentUser(t)}delete(){this.persistence._removeListener(this.fullUserKey,this.boundEventHandler)}static async create(e,t,r="authUser"){if(!t.length)return new Ms(pn(Sf),e,r);const s=(await Promise.all(t.map(async l=>{if(await l._isAvailable())return l}))).filter(l=>l);let i=s[0]||pn(Sf);const o=qa(r,e.config.apiKey,e.name);let a=null;for(const l of t)try{const h=await l._get(o);if(h){let f;if(typeof h=="string"){const p=await ac(e,{idToken:h}).catch(()=>{});if(!p)break;f=await Mt._fromGetAccountInfoResponse(e,p,h)}else f=Mt._fromJSON(e,h);l!==i&&(a=f),i=l;break}}catch{}const u=s.filter(l=>l._shouldAllowMigration);return!i._shouldAllowMigration||!u.length?new Ms(i,e,r):(i=u[0],a&&await i._set(o,a.toJSON()),await Promise.all(t.map(async l=>{if(l!==i)try{await l._remove(o)}catch{}})),new Ms(i,e,r))}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Rf(n){const e=n.toLowerCase();if(e.includes("opera/")||e.includes("opr/")||e.includes("opios/"))return"Opera";if(rg(e))return"IEMobile";if(e.includes("msie")||e.includes("trident/"))return"IE";if(e.includes("edge/"))return"Edge";if(eg(e))return"Firefox";if(e.includes("silk/"))return"Silk";if(ig(e))return"Blackberry";if(og(e))return"Webos";if(tg(e))return"Safari";if((e.includes("chrome/")||ng(e))&&!e.includes("edge/"))return"Chrome";if(sg(e))return"Android";{const t=/([a-zA-Z\d\.]+)\/[a-zA-Z\d\.]*$/,r=n.match(t);if((r==null?void 0:r.length)===2)return r[1]}return"Other"}function eg(n=Ye()){return/firefox\//i.test(n)}function tg(n=Ye()){const e=n.toLowerCase();return e.includes("safari/")&&!e.includes("chrome/")&&!e.includes("crios/")&&!e.includes("android")}function ng(n=Ye()){return/crios\//i.test(n)}function rg(n=Ye()){return/iemobile/i.test(n)}function sg(n=Ye()){return/android/i.test(n)}function ig(n=Ye()){return/blackberry/i.test(n)}function og(n=Ye()){return/webos/i.test(n)}function Hl(n=Ye()){return/iphone|ipad|ipod/i.test(n)||/macintosh/i.test(n)&&/mobile/i.test(n)}function UT(n=Ye()){var e;return Hl(n)&&!!((e=window.navigator)!=null&&e.standalone)}function $T(){return tE()&&document.documentMode===10}function ag(n=Ye()){return Hl(n)||sg(n)||og(n)||ig(n)||/windows phone/i.test(n)||rg(n)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function cg(n,e=[]){let t;switch(n){case"Browser":t=Rf(Ye());break;case"Worker":t=`${Rf(Ye())}-${n}`;break;default:t=n}const r=e.length?e.join(","):"FirebaseCore-web";return`${t}/JsCore/${as}/${r}`}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class qT{constructor(e){this.auth=e,this.queue=[]}pushCallback(e,t){const r=i=>new Promise((o,a)=>{try{const u=e(i);o(u)}catch(u){a(u)}});r.onAbort=t,this.queue.push(r);const s=this.queue.length-1;return()=>{this.queue[s]=()=>Promise.resolve()}}async runMiddleware(e){if(this.auth.currentUser===e)return;const t=[];try{for(const r of this.queue)await r(e),r.onAbort&&t.push(r.onAbort)}catch(r){t.reverse();for(const s of t)try{s()}catch{}throw this.auth._errorFactory.create("login-blocked",{originalMessage:r==null?void 0:r.message})}}}/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function jT(n,e={}){return vn(n,"GET","/v2/passwordPolicy",_r(n,e))}/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const GT=6;class zT{constructor(e){var r;const t=e.customStrengthOptions;this.customStrengthOptions={},this.customStrengthOptions.minPasswordLength=t.minPasswordLength??GT,t.maxPasswordLength&&(this.customStrengthOptions.maxPasswordLength=t.maxPasswordLength),t.containsLowercaseCharacter!==void 0&&(this.customStrengthOptions.containsLowercaseLetter=t.containsLowercaseCharacter),t.containsUppercaseCharacter!==void 0&&(this.customStrengthOptions.containsUppercaseLetter=t.containsUppercaseCharacter),t.containsNumericCharacter!==void 0&&(this.customStrengthOptions.containsNumericCharacter=t.containsNumericCharacter),t.containsNonAlphanumericCharacter!==void 0&&(this.customStrengthOptions.containsNonAlphanumericCharacter=t.containsNonAlphanumericCharacter),this.enforcementState=e.enforcementState,this.enforcementState==="ENFORCEMENT_STATE_UNSPECIFIED"&&(this.enforcementState="OFF"),this.allowedNonAlphanumericCharacters=((r=e.allowedNonAlphanumericCharacters)==null?void 0:r.join(""))??"",this.forceUpgradeOnSignin=e.forceUpgradeOnSignin??!1,this.schemaVersion=e.schemaVersion}validatePassword(e){const t={isValid:!0,passwordPolicy:this};return this.validatePasswordLengthOptions(e,t),this.validatePasswordCharacterOptions(e,t),t.isValid&&(t.isValid=t.meetsMinPasswordLength??!0),t.isValid&&(t.isValid=t.meetsMaxPasswordLength??!0),t.isValid&&(t.isValid=t.containsLowercaseLetter??!0),t.isValid&&(t.isValid=t.containsUppercaseLetter??!0),t.isValid&&(t.isValid=t.containsNumericCharacter??!0),t.isValid&&(t.isValid=t.containsNonAlphanumericCharacter??!0),t}validatePasswordLengthOptions(e,t){const r=this.customStrengthOptions.minPasswordLength,s=this.customStrengthOptions.maxPasswordLength;r&&(t.meetsMinPasswordLength=e.length>=r),s&&(t.meetsMaxPasswordLength=e.length<=s)}validatePasswordCharacterOptions(e,t){this.updatePasswordCharacterOptionsStatuses(t,!1,!1,!1,!1);let r;for(let s=0;s<e.length;s++)r=e.charAt(s),this.updatePasswordCharacterOptionsStatuses(t,r>="a"&&r<="z",r>="A"&&r<="Z",r>="0"&&r<="9",this.allowedNonAlphanumericCharacters.includes(r))}updatePasswordCharacterOptionsStatuses(e,t,r,s,i){this.customStrengthOptions.containsLowercaseLetter&&(e.containsLowercaseLetter||(e.containsLowercaseLetter=t)),this.customStrengthOptions.containsUppercaseLetter&&(e.containsUppercaseLetter||(e.containsUppercaseLetter=r)),this.customStrengthOptions.containsNumericCharacter&&(e.containsNumericCharacter||(e.containsNumericCharacter=s)),this.customStrengthOptions.containsNonAlphanumericCharacter&&(e.containsNonAlphanumericCharacter||(e.containsNonAlphanumericCharacter=i))}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class KT{constructor(e,t,r,s){this.app=e,this.heartbeatServiceProvider=t,this.appCheckServiceProvider=r,this.config=s,this.currentUser=null,this.emulatorConfig=null,this.operations=Promise.resolve(),this.authStateSubscription=new Pf(this),this.idTokenSubscription=new Pf(this),this.beforeStateQueue=new qT(this),this.redirectUser=null,this.isProactiveRefreshEnabled=!1,this.EXPECTED_PASSWORD_POLICY_SCHEMA_VERSION=1,this._canInitEmulator=!0,this._isInitialized=!1,this._deleted=!1,this._initializationPromise=null,this._popupRedirectResolver=null,this._errorFactory=Wp,this._agentRecaptchaConfig=null,this._tenantRecaptchaConfigs={},this._projectPasswordPolicy=null,this._tenantPasswordPolicies={},this._resolvePersistenceManagerAvailable=void 0,this.lastNotifiedUid=void 0,this.languageCode=null,this.tenantId=null,this.settings={appVerificationDisabledForTesting:!1},this.frameworks=[],this.name=e.name,this.clientVersion=s.sdkClientVersion,this._persistenceManagerAvailable=new Promise(i=>this._resolvePersistenceManagerAvailable=i)}_initializeWithPersistence(e,t){return t&&(this._popupRedirectResolver=pn(t)),this._initializationPromise=this.queue(async()=>{var r,s,i;if(!this._deleted&&(this.persistenceManager=await Ms.create(this,e),(r=this._resolvePersistenceManagerAvailable)==null||r.call(this),!this._deleted)){if((s=this._popupRedirectResolver)!=null&&s._shouldInitProactively)try{await this._popupRedirectResolver._initialize(this)}catch{}await this.initializeCurrentUser(t),this.lastNotifiedUid=((i=this.currentUser)==null?void 0:i.uid)||null,!this._deleted&&(this._isInitialized=!0)}}),this._initializationPromise}async _onStorageEvent(){if(this._deleted)return;const e=await this.assertedPersistence.getCurrentUser();if(!(!this.currentUser&&!e)){if(this.currentUser&&e&&this.currentUser.uid===e.uid){this._currentUser._assign(e),await this.currentUser.getIdToken();return}await this._updateCurrentUser(e,!0)}}async initializeCurrentUserFromIdToken(e){try{const t=await ac(this,{idToken:e}),r=await Mt._fromGetAccountInfoResponse(this,t,e);await this.directlySetCurrentUser(r)}catch(t){console.warn("FirebaseServerApp could not login user with provided authIdToken: ",t),await this.directlySetCurrentUser(null)}}async initializeCurrentUser(e){var i;if(Ct(this.app)){const o=this.app.settings.authIdToken;return o?new Promise(a=>{setTimeout(()=>this.initializeCurrentUserFromIdToken(o).then(a,a))}):this.directlySetCurrentUser(null)}const t=await this.assertedPersistence.getCurrentUser();let r=t,s=!1;if(e&&this.config.authDomain){await this.getOrInitRedirectPersistenceManager();const o=(i=this.redirectUser)==null?void 0:i._redirectEventId,a=r==null?void 0:r._redirectEventId,u=await this.tryRedirectSignIn(e);(!o||o===a)&&(u!=null&&u.user)&&(r=u.user,s=!0)}if(!r)return this.directlySetCurrentUser(null);if(!r._redirectEventId){if(s)try{await this.beforeStateQueue.runMiddleware(r)}catch(o){r=t,this._popupRedirectResolver._overrideRedirectResult(this,()=>Promise.reject(o))}return r?this.reloadAndSetCurrentUserOrClear(r):this.directlySetCurrentUser(null)}return ee(this._popupRedirectResolver,this,"argument-error"),await this.getOrInitRedirectPersistenceManager(),this.redirectUser&&this.redirectUser._redirectEventId===r._redirectEventId?this.directlySetCurrentUser(r):this.reloadAndSetCurrentUserOrClear(r)}async tryRedirectSignIn(e){let t=null;try{t=await this._popupRedirectResolver._completeRedirectFn(this,e,!0)}catch{await this._setRedirectUser(null)}return t}async reloadAndSetCurrentUserOrClear(e){try{await cc(e)}catch(t){if((t==null?void 0:t.code)!=="auth/network-request-failed")return this.directlySetCurrentUser(null)}return this.directlySetCurrentUser(e)}useDeviceLanguage(){this.languageCode=vT()}async _delete(){this._deleted=!0}async updateCurrentUser(e){if(Ct(this.app))return Promise.reject(sr(this));const t=e?ge(e):null;return t&&ee(t.auth.config.apiKey===this.config.apiKey,this,"invalid-user-token"),this._updateCurrentUser(t&&t._clone(this))}async _updateCurrentUser(e,t=!1){if(!this._deleted)return e&&ee(this.tenantId===e.tenantId,this,"tenant-id-mismatch"),t||await this.beforeStateQueue.runMiddleware(e),this.queue(async()=>{await this.directlySetCurrentUser(e),this.notifyAuthListeners()})}async signOut(){return Ct(this.app)?Promise.reject(sr(this)):(await this.beforeStateQueue.runMiddleware(null),(this.redirectPersistenceManager||this._popupRedirectResolver)&&await this._setRedirectUser(null),this._updateCurrentUser(null,!0))}setPersistence(e){return Ct(this.app)?Promise.reject(sr(this)):this.queue(async()=>{await this.assertedPersistence.setPersistence(pn(e))})}_getRecaptchaConfig(){return this.tenantId==null?this._agentRecaptchaConfig:this._tenantRecaptchaConfigs[this.tenantId]}async validatePassword(e){this._getPasswordPolicyInternal()||await this._updatePasswordPolicy();const t=this._getPasswordPolicyInternal();return t.schemaVersion!==this.EXPECTED_PASSWORD_POLICY_SCHEMA_VERSION?Promise.reject(this._errorFactory.create("unsupported-password-policy-schema-version",{})):t.validatePassword(e)}_getPasswordPolicyInternal(){return this.tenantId===null?this._projectPasswordPolicy:this._tenantPasswordPolicies[this.tenantId]}async _updatePasswordPolicy(){const e=await jT(this),t=new zT(e);this.tenantId===null?this._projectPasswordPolicy=t:this._tenantPasswordPolicies[this.tenantId]=t}_getPersistenceType(){return this.assertedPersistence.persistence.type}_getPersistence(){return this.assertedPersistence.persistence}_updateErrorMap(e){this._errorFactory=new Qo("auth","Firebase",e())}onAuthStateChanged(e,t,r){return this.registerStateListener(this.authStateSubscription,e,t,r)}beforeAuthStateChanged(e,t){return this.beforeStateQueue.pushCallback(e,t)}onIdTokenChanged(e,t,r){return this.registerStateListener(this.idTokenSubscription,e,t,r)}authStateReady(){return new Promise((e,t)=>{if(this.currentUser)e();else{const r=this.onAuthStateChanged(()=>{r(),e()},t)}})}async revokeAccessToken(e){if(this.currentUser){const t=await this.currentUser.getIdToken(),r={providerId:"apple.com",tokenType:"ACCESS_TOKEN",token:e,idToken:t};this.tenantId!=null&&(r.tenantId=this.tenantId),await FT(this,r)}}toJSON(){var e;return{apiKey:this.config.apiKey,authDomain:this.config.authDomain,appName:this.name,currentUser:(e=this._currentUser)==null?void 0:e.toJSON()}}async _setRedirectUser(e,t){const r=await this.getOrInitRedirectPersistenceManager(t);return e===null?r.removeCurrentUser():r.setCurrentUser(e)}async getOrInitRedirectPersistenceManager(e){if(!this.redirectPersistenceManager){const t=e&&pn(e)||this._popupRedirectResolver;ee(t,this,"argument-error"),this.redirectPersistenceManager=await Ms.create(this,[pn(t._redirectPersistence)],"redirectUser"),this.redirectUser=await this.redirectPersistenceManager.getCurrentUser()}return this.redirectPersistenceManager}async _redirectUserForId(e){var t,r;return this._isInitialized&&await this.queue(async()=>{}),((t=this._currentUser)==null?void 0:t._redirectEventId)===e?this._currentUser:((r=this.redirectUser)==null?void 0:r._redirectEventId)===e?this.redirectUser:null}async _persistUserIfCurrent(e){if(e===this.currentUser)return this.queue(async()=>this.directlySetCurrentUser(e))}_notifyListenersIfCurrent(e){e===this.currentUser&&this.notifyAuthListeners()}_key(){return`${this.config.authDomain}:${this.config.apiKey}:${this.name}`}_startProactiveRefresh(){this.isProactiveRefreshEnabled=!0,this.currentUser&&this._currentUser._startProactiveRefresh()}_stopProactiveRefresh(){this.isProactiveRefreshEnabled=!1,this.currentUser&&this._currentUser._stopProactiveRefresh()}get _currentUser(){return this.currentUser}notifyAuthListeners(){var t;if(!this._isInitialized)return;this.idTokenSubscription.next(this.currentUser);const e=((t=this.currentUser)==null?void 0:t.uid)??null;this.lastNotifiedUid!==e&&(this.lastNotifiedUid=e,this.authStateSubscription.next(this.currentUser))}registerStateListener(e,t,r,s){if(this._deleted)return()=>{};const i=typeof t=="function"?t:t.next.bind(t);let o=!1;const a=this._isInitialized?Promise.resolve():this._initializationPromise;if(ee(a,this,"internal-error"),a.then(()=>{o||i(this.currentUser)}),typeof t=="function"){const u=e.addObserver(t,r,s);return()=>{o=!0,u()}}else{const u=e.addObserver(t);return()=>{o=!0,u()}}}async directlySetCurrentUser(e){this.currentUser&&this.currentUser!==e&&this._currentUser._stopProactiveRefresh(),e&&this.isProactiveRefreshEnabled&&e._startProactiveRefresh(),this.currentUser=e,e?await this.assertedPersistence.setCurrentUser(e):await this.assertedPersistence.removeCurrentUser()}queue(e){return this.operations=this.operations.then(e,e),this.operations}get assertedPersistence(){return ee(this.persistenceManager,this,"internal-error"),this.persistenceManager}_logFramework(e){!e||this.frameworks.includes(e)||(this.frameworks.push(e),this.frameworks.sort(),this.clientVersion=cg(this.config.clientPlatform,this._getFrameworks()))}_getFrameworks(){return this.frameworks}async _getAdditionalHeaders(){var s;const e={"X-Client-Version":this.clientVersion};this.app.options.appId&&(e["X-Firebase-gmpid"]=this.app.options.appId);const t=await((s=this.heartbeatServiceProvider.getImmediate({optional:!0}))==null?void 0:s.getHeartbeatsHeader());t&&(e["X-Firebase-Client"]=t);const r=await this._getAppCheckToken();return r&&(e["X-Firebase-AppCheck"]=r),e}async _getAppCheckToken(){var t;if(Ct(this.app)&&this.app.settings.appCheckToken)return this.app.settings.appCheckToken;const e=await((t=this.appCheckServiceProvider.getImmediate({optional:!0}))==null?void 0:t.getToken());return e!=null&&e.error&&ET(`Error while retrieving App Check token: ${e.error}`),e==null?void 0:e.token}}function cs(n){return ge(n)}class Pf{constructor(e){this.auth=e,this.observer=null,this.addObserver=aE(t=>this.observer=t)}get next(){return ee(this.observer,this.auth,"internal-error"),this.observer.next.bind(this.observer)}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */let xc={async loadJS(){throw new Error("Unable to load external scripts")},recaptchaV2Script:"",recaptchaEnterpriseScript:"",gapiScript:""};function WT(n){xc=n}function ug(n){return xc.loadJS(n)}function HT(){return xc.recaptchaEnterpriseScript}function QT(){return xc.gapiScript}function JT(n){return`__${n}${Math.floor(Math.random()*1e6)}`}class YT{constructor(){this.enterprise=new XT}ready(e){e()}execute(e,t){return Promise.resolve("token")}render(e,t){return""}}class XT{ready(e){e()}execute(e,t){return Promise.resolve("token")}render(e,t){return""}}const ZT="recaptcha-enterprise",lg="NO_RECAPTCHA";class eA{constructor(e){this.type=ZT,this.auth=cs(e)}async verify(e="verify",t=!1){async function r(i){if(!t){if(i.tenantId==null&&i._agentRecaptchaConfig!=null)return i._agentRecaptchaConfig.siteKey;if(i.tenantId!=null&&i._tenantRecaptchaConfigs[i.tenantId]!==void 0)return i._tenantRecaptchaConfigs[i.tenantId].siteKey}return new Promise(async(o,a)=>{NT(i,{clientType:"CLIENT_TYPE_WEB",version:"RECAPTCHA_ENTERPRISE"}).then(u=>{if(u.recaptchaKey===void 0)a(new Error("recaptcha Enterprise site key undefined"));else{const l=new CT(u);return i.tenantId==null?i._agentRecaptchaConfig=l:i._tenantRecaptchaConfigs[i.tenantId]=l,o(l.siteKey)}}).catch(u=>{a(u)})})}function s(i,o,a){const u=window.grecaptcha;Af(u)?u.enterprise.ready(()=>{u.enterprise.execute(i,{action:e}).then(l=>{o(l)}).catch(()=>{o(lg)})}):a(Error("No reCAPTCHA enterprise script loaded."))}return this.auth.settings.appVerificationDisabledForTesting?new YT().execute("siteKey",{action:"verify"}):new Promise((i,o)=>{r(this.auth).then(a=>{if(!t&&Af(window.grecaptcha))s(a,i,o);else{if(typeof window>"u"){o(new Error("RecaptchaVerifier is only supported in browser"));return}let u=HT();u.length!==0&&(u+=a),ug(u).then(()=>{s(a,i,o)}).catch(l=>{o(l)})}}).catch(a=>{o(a)})})}}async function kf(n,e,t,r=!1,s=!1){const i=new eA(n);let o;if(s)o=lg;else try{o=await i.verify(t)}catch{o=await i.verify(t,!0)}const a={...e};if(t==="mfaSmsEnrollment"||t==="mfaSmsSignIn"){if("phoneEnrollmentInfo"in a){const u=a.phoneEnrollmentInfo.phoneNumber,l=a.phoneEnrollmentInfo.recaptchaToken;Object.assign(a,{phoneEnrollmentInfo:{phoneNumber:u,recaptchaToken:l,captchaResponse:o,clientType:"CLIENT_TYPE_WEB",recaptchaVersion:"RECAPTCHA_ENTERPRISE"}})}else if("phoneSignInInfo"in a){const u=a.phoneSignInInfo.recaptchaToken;Object.assign(a,{phoneSignInInfo:{recaptchaToken:u,captchaResponse:o,clientType:"CLIENT_TYPE_WEB",recaptchaVersion:"RECAPTCHA_ENTERPRISE"}})}return a}return r?Object.assign(a,{captchaResp:o}):Object.assign(a,{captchaResponse:o}),Object.assign(a,{clientType:"CLIENT_TYPE_WEB"}),Object.assign(a,{recaptchaVersion:"RECAPTCHA_ENTERPRISE"}),a}async function ol(n,e,t,r,s){var i;if((i=n._getRecaptchaConfig())!=null&&i.isProviderEnabled("EMAIL_PASSWORD_PROVIDER")){const o=await kf(n,e,t,t==="getOobCode");return r(n,o)}else return r(n,e).catch(async o=>{if(o.code==="auth/missing-recaptcha-token"){console.log(`${t} is protected by reCAPTCHA Enterprise for this project. Automatically triggering the reCAPTCHA flow and restarting the flow.`);const a=await kf(n,e,t,t==="getOobCode");return r(n,a)}else return Promise.reject(o)})}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function tA(n,e){const t=fi(n,"auth");if(t.isInitialized()){const s=t.getImmediate(),i=t.getOptions();if(Bt(i,e??{}))return s;Ft(s,"already-initialized")}return t.initialize({options:e})}function nA(n,e){const t=(e==null?void 0:e.persistence)||[],r=(Array.isArray(t)?t:[t]).map(pn);e!=null&&e.errorMap&&n._updateErrorMap(e.errorMap),n._initializeWithPersistence(r,e==null?void 0:e.popupRedirectResolver)}function rA(n,e,t){const r=cs(n);ee(/^https?:\/\//.test(e),r,"invalid-emulator-scheme");const s=!1,i=hg(e),{host:o,port:a}=sA(e),u=a===null?"":`:${a}`,l={url:`${i}//${o}${u}/`},h=Object.freeze({host:o,port:a,protocol:i.replace(":",""),options:Object.freeze({disableWarnings:s})});if(!r._canInitEmulator){ee(r.config.emulator&&r.emulatorConfig,r,"emulator-config-failed"),ee(Bt(l,r.config.emulator)&&Bt(h,r.emulatorConfig),r,"emulator-config-failed");return}r.config.emulator=l,r.emulatorConfig=h,r.settings.appVerificationDisabledForTesting=!0,gr(o)?Dc(`${i}//${o}${u}`):iA()}function hg(n){const e=n.indexOf(":");return e<0?"":n.substr(0,e+1)}function sA(n){const e=hg(n),t=/(\/\/)?([^?#/]+)/.exec(n.substr(e.length));if(!t)return{host:"",port:null};const r=t[2].split("@").pop()||"",s=/^(\[[^\]]+\])(:|$)/.exec(r);if(s){const i=s[1];return{host:i,port:Cf(r.substr(i.length+1))}}else{const[i,o]=r.split(":");return{host:i,port:Cf(o)}}}function Cf(n){if(!n)return null;const e=Number(n);return isNaN(e)?null:e}function iA(){function n(){const e=document.createElement("p"),t=e.style;e.innerText="Running in emulator mode. Do not use with production credentials.",t.position="fixed",t.width="100%",t.backgroundColor="#ffffff",t.border=".1em solid #000000",t.color="#b50000",t.bottom="0px",t.left="0px",t.margin="0px",t.zIndex="10000",t.textAlign="center",e.classList.add("firebase-emulator-warning"),document.body.appendChild(e)}typeof console<"u"&&typeof console.info=="function"&&console.info("WARNING: You are using the Auth Emulator, which is intended for local testing only.  Do not use with production credentials."),typeof window<"u"&&typeof document<"u"&&(document.readyState==="loading"?window.addEventListener("DOMContentLoaded",n):n())}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Ql{constructor(e,t){this.providerId=e,this.signInMethod=t}toJSON(){return mn("not implemented")}_getIdTokenResponse(e){return mn("not implemented")}_linkToIdToken(e,t){return mn("not implemented")}_getReauthenticationResolver(e){return mn("not implemented")}}async function oA(n,e){return vn(n,"POST","/v1/accounts:signUp",e)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function aA(n,e){return Oc(n,"POST","/v1/accounts:signInWithPassword",_r(n,e))}async function cA(n,e){return vn(n,"POST","/v1/accounts:sendOobCode",_r(n,e))}async function uA(n,e){return cA(n,e)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function lA(n,e){return Oc(n,"POST","/v1/accounts:signInWithEmailLink",_r(n,e))}async function hA(n,e){return Oc(n,"POST","/v1/accounts:signInWithEmailLink",_r(n,e))}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Co extends Ql{constructor(e,t,r,s=null){super("password",r),this._email=e,this._password=t,this._tenantId=s}static _fromEmailAndPassword(e,t){return new Co(e,t,"password")}static _fromEmailAndCode(e,t,r=null){return new Co(e,t,"emailLink",r)}toJSON(){return{email:this._email,password:this._password,signInMethod:this.signInMethod,tenantId:this._tenantId}}static fromJSON(e){const t=typeof e=="string"?JSON.parse(e):e;if(t!=null&&t.email&&(t!=null&&t.password)){if(t.signInMethod==="password")return this._fromEmailAndPassword(t.email,t.password);if(t.signInMethod==="emailLink")return this._fromEmailAndCode(t.email,t.password,t.tenantId)}return null}async _getIdTokenResponse(e){switch(this.signInMethod){case"password":const t={returnSecureToken:!0,email:this._email,password:this._password,clientType:"CLIENT_TYPE_WEB"};return ol(e,t,"signInWithPassword",aA);case"emailLink":return lA(e,{email:this._email,oobCode:this._password});default:Ft(e,"internal-error")}}async _linkToIdToken(e,t){switch(this.signInMethod){case"password":const r={idToken:t,returnSecureToken:!0,email:this._email,password:this._password,clientType:"CLIENT_TYPE_WEB"};return ol(e,r,"signUpPassword",oA);case"emailLink":return hA(e,{idToken:t,email:this._email,oobCode:this._password});default:Ft(e,"internal-error")}}_getReauthenticationResolver(e){return this._getIdTokenResponse(e)}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function Ls(n,e){return Oc(n,"POST","/v1/accounts:signInWithIdp",_r(n,e))}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const dA="http://localhost";class Hr extends Ql{constructor(){super(...arguments),this.pendingToken=null}static _fromParams(e){const t=new Hr(e.providerId,e.signInMethod);return e.idToken||e.accessToken?(e.idToken&&(t.idToken=e.idToken),e.accessToken&&(t.accessToken=e.accessToken),e.nonce&&!e.pendingToken&&(t.nonce=e.nonce),e.pendingToken&&(t.pendingToken=e.pendingToken)):e.oauthToken&&e.oauthTokenSecret?(t.accessToken=e.oauthToken,t.secret=e.oauthTokenSecret):Ft("argument-error"),t}toJSON(){return{idToken:this.idToken,accessToken:this.accessToken,secret:this.secret,nonce:this.nonce,pendingToken:this.pendingToken,providerId:this.providerId,signInMethod:this.signInMethod}}static fromJSON(e){const t=typeof e=="string"?JSON.parse(e):e,{providerId:r,signInMethod:s,...i}=t;if(!r||!s)return null;const o=new Hr(r,s);return o.idToken=i.idToken||void 0,o.accessToken=i.accessToken||void 0,o.secret=i.secret,o.nonce=i.nonce,o.pendingToken=i.pendingToken||null,o}_getIdTokenResponse(e){const t=this.buildRequest();return Ls(e,t)}_linkToIdToken(e,t){const r=this.buildRequest();return r.idToken=t,Ls(e,r)}_getReauthenticationResolver(e){const t=this.buildRequest();return t.autoCreate=!1,Ls(e,t)}buildRequest(){const e={requestUri:dA,returnSecureToken:!0};if(this.pendingToken)e.pendingToken=this.pendingToken;else{const t={};this.idToken&&(t.id_token=this.idToken),this.accessToken&&(t.access_token=this.accessToken),this.secret&&(t.oauth_token_secret=this.secret),t.providerId=this.providerId,this.nonce&&!this.pendingToken&&(t.nonce=this.nonce),e.postBody=Jo(t)}return e}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function fA(n){switch(n){case"recoverEmail":return"RECOVER_EMAIL";case"resetPassword":return"PASSWORD_RESET";case"signIn":return"EMAIL_SIGNIN";case"verifyEmail":return"VERIFY_EMAIL";case"verifyAndChangeEmail":return"VERIFY_AND_CHANGE_EMAIL";case"revertSecondFactorAddition":return"REVERT_SECOND_FACTOR_ADDITION";default:return null}}function mA(n){const e=co(uo(n)).link,t=e?co(uo(e)).deep_link_id:null,r=co(uo(n)).deep_link_id;return(r?co(uo(r)).link:null)||r||t||e||n}class Jl{constructor(e){const t=co(uo(e)),r=t.apiKey??null,s=t.oobCode??null,i=fA(t.mode??null);ee(r&&s&&i,"argument-error"),this.apiKey=r,this.operation=i,this.code=s,this.continueUrl=t.continueUrl??null,this.languageCode=t.lang??null,this.tenantId=t.tenantId??null}static parseLink(e){const t=mA(e);try{return new Jl(t)}catch{return null}}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class mi{constructor(){this.providerId=mi.PROVIDER_ID}static credential(e,t){return Co._fromEmailAndPassword(e,t)}static credentialWithLink(e,t){const r=Jl.parseLink(t);return ee(r,"argument-error"),Co._fromEmailAndCode(e,r.code,r.tenantId)}}mi.PROVIDER_ID="password";mi.EMAIL_PASSWORD_SIGN_IN_METHOD="password";mi.EMAIL_LINK_SIGN_IN_METHOD="emailLink";/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class dg{constructor(e){this.providerId=e,this.defaultLanguageCode=null,this.customParameters={}}setDefaultLanguage(e){this.defaultLanguageCode=e}setCustomParameters(e){return this.customParameters=e,this}getCustomParameters(){return this.customParameters}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Xo extends dg{constructor(){super(...arguments),this.scopes=[]}addScope(e){return this.scopes.includes(e)||this.scopes.push(e),this}getScopes(){return[...this.scopes]}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class zn extends Xo{constructor(){super("facebook.com")}static credential(e){return Hr._fromParams({providerId:zn.PROVIDER_ID,signInMethod:zn.FACEBOOK_SIGN_IN_METHOD,accessToken:e})}static credentialFromResult(e){return zn.credentialFromTaggedObject(e)}static credentialFromError(e){return zn.credentialFromTaggedObject(e.customData||{})}static credentialFromTaggedObject({_tokenResponse:e}){if(!e||!("oauthAccessToken"in e)||!e.oauthAccessToken)return null;try{return zn.credential(e.oauthAccessToken)}catch{return null}}}zn.FACEBOOK_SIGN_IN_METHOD="facebook.com";zn.PROVIDER_ID="facebook.com";/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Kn extends Xo{constructor(){super("google.com"),this.addScope("profile")}static credential(e,t){return Hr._fromParams({providerId:Kn.PROVIDER_ID,signInMethod:Kn.GOOGLE_SIGN_IN_METHOD,idToken:e,accessToken:t})}static credentialFromResult(e){return Kn.credentialFromTaggedObject(e)}static credentialFromError(e){return Kn.credentialFromTaggedObject(e.customData||{})}static credentialFromTaggedObject({_tokenResponse:e}){if(!e)return null;const{oauthIdToken:t,oauthAccessToken:r}=e;if(!t&&!r)return null;try{return Kn.credential(t,r)}catch{return null}}}Kn.GOOGLE_SIGN_IN_METHOD="google.com";Kn.PROVIDER_ID="google.com";/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Wn extends Xo{constructor(){super("github.com")}static credential(e){return Hr._fromParams({providerId:Wn.PROVIDER_ID,signInMethod:Wn.GITHUB_SIGN_IN_METHOD,accessToken:e})}static credentialFromResult(e){return Wn.credentialFromTaggedObject(e)}static credentialFromError(e){return Wn.credentialFromTaggedObject(e.customData||{})}static credentialFromTaggedObject({_tokenResponse:e}){if(!e||!("oauthAccessToken"in e)||!e.oauthAccessToken)return null;try{return Wn.credential(e.oauthAccessToken)}catch{return null}}}Wn.GITHUB_SIGN_IN_METHOD="github.com";Wn.PROVIDER_ID="github.com";/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Hn extends Xo{constructor(){super("twitter.com")}static credential(e,t){return Hr._fromParams({providerId:Hn.PROVIDER_ID,signInMethod:Hn.TWITTER_SIGN_IN_METHOD,oauthToken:e,oauthTokenSecret:t})}static credentialFromResult(e){return Hn.credentialFromTaggedObject(e)}static credentialFromError(e){return Hn.credentialFromTaggedObject(e.customData||{})}static credentialFromTaggedObject({_tokenResponse:e}){if(!e)return null;const{oauthAccessToken:t,oauthTokenSecret:r}=e;if(!t||!r)return null;try{return Hn.credential(t,r)}catch{return null}}}Hn.TWITTER_SIGN_IN_METHOD="twitter.com";Hn.PROVIDER_ID="twitter.com";/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Gs{constructor(e){this.user=e.user,this.providerId=e.providerId,this._tokenResponse=e._tokenResponse,this.operationType=e.operationType}static async _fromIdTokenResponse(e,t,r,s=!1){const i=await Mt._fromIdTokenResponse(e,r,s),o=Nf(r);return new Gs({user:i,providerId:o,_tokenResponse:r,operationType:t})}static async _forOperation(e,t,r){await e._updateTokensIfNecessary(r,!0);const s=Nf(r);return new Gs({user:e,providerId:s,_tokenResponse:r,operationType:t})}}function Nf(n){return n.providerId?n.providerId:"phoneNumber"in n?"phone":null}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class uc extends un{constructor(e,t,r,s){super(t.code,t.message),this.operationType=r,this.user=s,Object.setPrototypeOf(this,uc.prototype),this.customData={appName:e.name,tenantId:e.tenantId??void 0,_serverResponse:t.customData._serverResponse,operationType:r}}static _fromErrorAndOperation(e,t,r,s){return new uc(e,t,r,s)}}function fg(n,e,t,r){return(e==="reauthenticate"?t._getReauthenticationResolver(n):t._getIdTokenResponse(n)).catch(i=>{throw i.code==="auth/multi-factor-auth-required"?uc._fromErrorAndOperation(n,i,e,r):i})}async function pA(n,e,t=!1){const r=await ko(n,e._linkToIdToken(n.auth,await n.getIdToken()),t);return Gs._forOperation(n,"link",r)}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function gA(n,e,t=!1){const{auth:r}=n;if(Ct(r.app))return Promise.reject(sr(r));const s="reauthenticate";try{const i=await ko(n,fg(r,s,e,n),t);ee(i.idToken,r,"internal-error");const o=Wl(i.idToken);ee(o,r,"internal-error");const{sub:a}=o;return ee(n.uid===a,r,"user-mismatch"),Gs._forOperation(n,s,i)}catch(i){throw(i==null?void 0:i.code)==="auth/user-not-found"&&Ft(r,"user-mismatch"),i}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function mg(n,e,t=!1){if(Ct(n.app))return Promise.reject(sr(n));const r="signIn",s=await fg(n,r,e),i=await Gs._fromIdTokenResponse(n,r,s);return t||await n._updateCurrentUser(i.user),i}async function _A(n,e){return mg(cs(n),e)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function yA(n){const e=cs(n);e._getPasswordPolicyInternal()&&await e._updatePasswordPolicy()}async function D0(n,e,t){const r=cs(n);await ol(r,{requestType:"PASSWORD_RESET",email:e,clientType:"CLIENT_TYPE_WEB"},"getOobCode",uA)}function V0(n,e,t){return Ct(n.app)?Promise.reject(sr(n)):_A(ge(n),mi.credential(e,t)).catch(async r=>{throw r.code==="auth/password-does-not-meet-requirements"&&yA(n),r})}function IA(n,e,t,r){return ge(n).onIdTokenChanged(e,t,r)}function wA(n,e,t){return ge(n).beforeAuthStateChanged(e,t)}function O0(n,e,t,r){return ge(n).onAuthStateChanged(e,t,r)}const lc="__sak";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class pg{constructor(e,t){this.storageRetriever=e,this.type=t}_isAvailable(){try{return this.storage?(this.storage.setItem(lc,"1"),this.storage.removeItem(lc),Promise.resolve(!0)):Promise.resolve(!1)}catch{return Promise.resolve(!1)}}_set(e,t){return this.storage.setItem(e,JSON.stringify(t)),Promise.resolve()}_get(e){const t=this.storage.getItem(e);return Promise.resolve(t?JSON.parse(t):null)}_remove(e){return this.storage.removeItem(e),Promise.resolve()}get storage(){return this.storageRetriever()}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const EA=1e3,TA=10;class gg extends pg{constructor(){super(()=>window.localStorage,"LOCAL"),this.boundEventHandler=(e,t)=>this.onStorageEvent(e,t),this.listeners={},this.localCache={},this.pollTimer=null,this.fallbackToPolling=ag(),this._shouldAllowMigration=!0}forAllChangedKeys(e){for(const t of Object.keys(this.listeners)){const r=this.storage.getItem(t),s=this.localCache[t];r!==s&&e(t,s,r)}}onStorageEvent(e,t=!1){if(!e.key){this.forAllChangedKeys((o,a,u)=>{this.notifyListeners(o,u)});return}const r=e.key;t?this.detachListener():this.stopPolling();const s=()=>{const o=this.storage.getItem(r);!t&&this.localCache[r]===o||this.notifyListeners(r,o)},i=this.storage.getItem(r);$T()&&i!==e.newValue&&e.newValue!==e.oldValue?setTimeout(s,TA):s()}notifyListeners(e,t){this.localCache[e]=t;const r=this.listeners[e];if(r)for(const s of Array.from(r))s(t&&JSON.parse(t))}startPolling(){this.stopPolling(),this.pollTimer=setInterval(()=>{this.forAllChangedKeys((e,t,r)=>{this.onStorageEvent(new StorageEvent("storage",{key:e,oldValue:t,newValue:r}),!0)})},EA)}stopPolling(){this.pollTimer&&(clearInterval(this.pollTimer),this.pollTimer=null)}attachListener(){window.addEventListener("storage",this.boundEventHandler)}detachListener(){window.removeEventListener("storage",this.boundEventHandler)}_addListener(e,t){Object.keys(this.listeners).length===0&&(this.fallbackToPolling?this.startPolling():this.attachListener()),this.listeners[e]||(this.listeners[e]=new Set,this.localCache[e]=this.storage.getItem(e)),this.listeners[e].add(t)}_removeListener(e,t){this.listeners[e]&&(this.listeners[e].delete(t),this.listeners[e].size===0&&delete this.listeners[e]),Object.keys(this.listeners).length===0&&(this.detachListener(),this.stopPolling())}async _set(e,t){await super._set(e,t),this.localCache[e]=JSON.stringify(t)}async _get(e){const t=await super._get(e);return this.localCache[e]=JSON.stringify(t),t}async _remove(e){await super._remove(e),delete this.localCache[e]}}gg.type="LOCAL";const AA=gg;/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class _g extends pg{constructor(){super(()=>window.sessionStorage,"SESSION")}_addListener(e,t){}_removeListener(e,t){}}_g.type="SESSION";const yg=_g;/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function vA(n){return Promise.all(n.map(async e=>{try{return{fulfilled:!0,value:await e}}catch(t){return{fulfilled:!1,reason:t}}}))}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Mc{constructor(e){this.eventTarget=e,this.handlersMap={},this.boundEventHandler=this.handleEvent.bind(this)}static _getInstance(e){const t=this.receivers.find(s=>s.isListeningto(e));if(t)return t;const r=new Mc(e);return this.receivers.push(r),r}isListeningto(e){return this.eventTarget===e}async handleEvent(e){const t=e,{eventId:r,eventType:s,data:i}=t.data,o=this.handlersMap[s];if(!(o!=null&&o.size))return;t.ports[0].postMessage({status:"ack",eventId:r,eventType:s});const a=Array.from(o).map(async l=>l(t.origin,i)),u=await vA(a);t.ports[0].postMessage({status:"done",eventId:r,eventType:s,response:u})}_subscribe(e,t){Object.keys(this.handlersMap).length===0&&this.eventTarget.addEventListener("message",this.boundEventHandler),this.handlersMap[e]||(this.handlersMap[e]=new Set),this.handlersMap[e].add(t)}_unsubscribe(e,t){this.handlersMap[e]&&t&&this.handlersMap[e].delete(t),(!t||this.handlersMap[e].size===0)&&delete this.handlersMap[e],Object.keys(this.handlersMap).length===0&&this.eventTarget.removeEventListener("message",this.boundEventHandler)}}Mc.receivers=[];/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Yl(n="",e=10){let t="";for(let r=0;r<e;r++)t+=Math.floor(Math.random()*10);return n+t}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class bA{constructor(e){this.target=e,this.handlers=new Set}removeMessageHandler(e){e.messageChannel&&(e.messageChannel.port1.removeEventListener("message",e.onMessage),e.messageChannel.port1.close()),this.handlers.delete(e)}async _send(e,t,r=50){const s=typeof MessageChannel<"u"?new MessageChannel:null;if(!s)throw new Error("connection_unavailable");let i,o;return new Promise((a,u)=>{const l=Yl("",20);s.port1.start();const h=setTimeout(()=>{u(new Error("unsupported_event"))},r);o={messageChannel:s,onMessage(f){const p=f;if(p.data.eventId===l)switch(p.data.status){case"ack":clearTimeout(h),i=setTimeout(()=>{u(new Error("timeout"))},3e3);break;case"done":clearTimeout(i),a(p.data.response);break;default:clearTimeout(h),clearTimeout(i),u(new Error("invalid_response"));break}}},this.handlers.add(o),s.port1.addEventListener("message",o.onMessage),this.target.postMessage({eventType:e,eventId:l,data:t},[s.port2])}).finally(()=>{o&&this.removeMessageHandler(o)})}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function en(){return window}function SA(n){en().location.href=n}/**
 * @license
 * Copyright 2020 Google LLC.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Ig(){return typeof en().WorkerGlobalScope<"u"&&typeof en().importScripts=="function"}async function RA(){if(!(navigator!=null&&navigator.serviceWorker))return null;try{return(await navigator.serviceWorker.ready).active}catch{return null}}function PA(){var n;return((n=navigator==null?void 0:navigator.serviceWorker)==null?void 0:n.controller)||null}function kA(){return Ig()?self:null}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const wg="firebaseLocalStorageDb",CA=1,hc="firebaseLocalStorage",Eg="fbase_key";class Zo{constructor(e){this.request=e}toPromise(){return new Promise((e,t)=>{this.request.addEventListener("success",()=>{e(this.request.result)}),this.request.addEventListener("error",()=>{t(this.request.error)})})}}function Lc(n,e){return n.transaction([hc],e?"readwrite":"readonly").objectStore(hc)}function NA(){const n=indexedDB.deleteDatabase(wg);return new Zo(n).toPromise()}function Tg(){const n=indexedDB.open(wg,CA);return new Promise((e,t)=>{n.addEventListener("error",()=>{t(n.error)}),n.addEventListener("upgradeneeded",()=>{const r=n.result;try{r.createObjectStore(hc,{keyPath:Eg})}catch(s){t(s)}}),n.addEventListener("success",async()=>{const r=n.result;r.objectStoreNames.contains(hc)?e(r):(r.close(),await NA(),e(await Tg()))})})}async function Df(n,e,t){const r=Lc(n,!0).put({[Eg]:e,value:t});return new Zo(r).toPromise()}async function DA(n,e){const t=Lc(n,!1).get(e),r=await new Zo(t).toPromise();return r===void 0?null:r.value}function Vf(n,e){const t=Lc(n,!0).delete(e);return new Zo(t).toPromise()}const VA=800,OA=3;class Ag{constructor(){this.type="LOCAL",this.dbPromise=null,this._shouldAllowMigration=!0,this.listeners={},this.localCache={},this.pollTimer=null,this.pendingWrites=0,this.receiver=null,this.sender=null,this.serviceWorkerReceiverAvailable=!1,this.activeServiceWorker=null,this._workerInitializationPromise=this.initializeServiceWorkerMessaging().then(()=>{},()=>{})}async _openDb(){return this.dbPromise?this.dbPromise:(this.dbPromise=Tg(),this.dbPromise.catch(()=>{this.dbPromise=null}),this.dbPromise)}async _withRetries(e){let t=0;for(;;)try{const r=await this._openDb();return await e(r)}catch(r){if(t++>OA)throw r;this.dbPromise&&((await this.dbPromise).close(),this.dbPromise=null)}}async initializeServiceWorkerMessaging(){return Ig()?this.initializeReceiver():this.initializeSender()}async initializeReceiver(){this.receiver=Mc._getInstance(kA()),this.receiver._subscribe("keyChanged",async(e,t)=>({keyProcessed:(await this._poll()).includes(t.key)})),this.receiver._subscribe("ping",async(e,t)=>["keyChanged"])}async initializeSender(){var t,r;if(this.activeServiceWorker=await RA(),!this.activeServiceWorker)return;this.sender=new bA(this.activeServiceWorker);const e=await this.sender._send("ping",{},800);e&&(t=e[0])!=null&&t.fulfilled&&(r=e[0])!=null&&r.value.includes("keyChanged")&&(this.serviceWorkerReceiverAvailable=!0)}async notifyServiceWorker(e){if(!(!this.sender||!this.activeServiceWorker||PA()!==this.activeServiceWorker))try{await this.sender._send("keyChanged",{key:e},this.serviceWorkerReceiverAvailable?800:50)}catch{}}async _isAvailable(){try{return indexedDB?(await this._withRetries(async e=>{await Df(e,lc,"1"),await Vf(e,lc)}),!0):!1}catch{}return!1}async _withPendingWrite(e){this.pendingWrites++;try{await e()}finally{this.pendingWrites--}}async _set(e,t){return this._withPendingWrite(async()=>(await this._withRetries(r=>Df(r,e,t)),this.localCache[e]=t,this.notifyServiceWorker(e)))}async _get(e){const t=await this._withRetries(r=>DA(r,e));return this.localCache[e]=t,t}async _remove(e){return this._withPendingWrite(async()=>(await this._withRetries(t=>Vf(t,e)),delete this.localCache[e],this.notifyServiceWorker(e)))}async _poll(){const e=await this._withRetries(s=>{const i=Lc(s,!1).getAll();return new Zo(i).toPromise()});if(!e)return[];if(this.pendingWrites!==0)return[];const t=[],r=new Set;if(e.length!==0)for(const{fbase_key:s,value:i}of e)r.add(s),JSON.stringify(this.localCache[s])!==JSON.stringify(i)&&(this.notifyListeners(s,i),t.push(s));for(const s of Object.keys(this.localCache))this.localCache[s]&&!r.has(s)&&(this.notifyListeners(s,null),t.push(s));return t}notifyListeners(e,t){this.localCache[e]=t;const r=this.listeners[e];if(r)for(const s of Array.from(r))s(t)}startPolling(){this.stopPolling(),this.pollTimer=setInterval(async()=>this._poll(),VA)}stopPolling(){this.pollTimer&&(clearInterval(this.pollTimer),this.pollTimer=null)}_addListener(e,t){Object.keys(this.listeners).length===0&&this.startPolling(),this.listeners[e]||(this.listeners[e]=new Set,this._get(e)),this.listeners[e].add(t)}_removeListener(e,t){this.listeners[e]&&(this.listeners[e].delete(t),this.listeners[e].size===0&&delete this.listeners[e]),Object.keys(this.listeners).length===0&&this.stopPolling()}}Ag.type="LOCAL";const xA=Ag;new Yo(3e4,6e4);/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function MA(n,e){return e?pn(e):(ee(n._popupRedirectResolver,n,"argument-error"),n._popupRedirectResolver)}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Xl extends Ql{constructor(e){super("custom","custom"),this.params=e}_getIdTokenResponse(e){return Ls(e,this._buildIdpRequest())}_linkToIdToken(e,t){return Ls(e,this._buildIdpRequest(t))}_getReauthenticationResolver(e){return Ls(e,this._buildIdpRequest())}_buildIdpRequest(e){const t={requestUri:this.params.requestUri,sessionId:this.params.sessionId,postBody:this.params.postBody,tenantId:this.params.tenantId,pendingToken:this.params.pendingToken,returnSecureToken:!0,returnIdpCredential:!0};return e&&(t.idToken=e),t}}function LA(n){return mg(n.auth,new Xl(n),n.bypassAuthState)}function BA(n){const{auth:e,user:t}=n;return ee(t,e,"internal-error"),gA(t,new Xl(n),n.bypassAuthState)}async function FA(n){const{auth:e,user:t}=n;return ee(t,e,"internal-error"),pA(t,new Xl(n),n.bypassAuthState)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class vg{constructor(e,t,r,s,i=!1){this.auth=e,this.resolver=r,this.user=s,this.bypassAuthState=i,this.pendingPromise=null,this.eventManager=null,this.filter=Array.isArray(t)?t:[t]}execute(){return new Promise(async(e,t)=>{this.pendingPromise={resolve:e,reject:t};try{this.eventManager=await this.resolver._initialize(this.auth),await this.onExecution(),this.eventManager.registerConsumer(this)}catch(r){this.reject(r)}})}async onAuthEvent(e){const{urlResponse:t,sessionId:r,postBody:s,tenantId:i,error:o,type:a}=e;if(o){this.reject(o);return}const u={auth:this.auth,requestUri:t,sessionId:r,tenantId:i||void 0,postBody:s||void 0,user:this.user,bypassAuthState:this.bypassAuthState};try{this.resolve(await this.getIdpTask(a)(u))}catch(l){this.reject(l)}}onError(e){this.reject(e)}getIdpTask(e){switch(e){case"signInViaPopup":case"signInViaRedirect":return LA;case"linkViaPopup":case"linkViaRedirect":return FA;case"reauthViaPopup":case"reauthViaRedirect":return BA;default:Ft(this.auth,"internal-error")}}resolve(e){yn(this.pendingPromise,"Pending promise was never set"),this.pendingPromise.resolve(e),this.unregisterAndCleanUp()}reject(e){yn(this.pendingPromise,"Pending promise was never set"),this.pendingPromise.reject(e),this.unregisterAndCleanUp()}unregisterAndCleanUp(){this.eventManager&&this.eventManager.unregisterConsumer(this),this.pendingPromise=null,this.cleanUp()}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const UA=new Yo(2e3,1e4);class Os extends vg{constructor(e,t,r,s,i){super(e,t,s,i),this.provider=r,this.authWindow=null,this.pollId=null,Os.currentPopupAction&&Os.currentPopupAction.cancel(),Os.currentPopupAction=this}async executeNotNull(){const e=await this.execute();return ee(e,this.auth,"internal-error"),e}async onExecution(){yn(this.filter.length===1,"Popup operations only handle one event");const e=Yl();this.authWindow=await this.resolver._openPopup(this.auth,this.provider,this.filter[0],e),this.authWindow.associatedEvent=e,this.resolver._originValidation(this.auth).catch(t=>{this.reject(t)}),this.resolver._isIframeWebStorageSupported(this.auth,t=>{t||this.reject(Zt(this.auth,"web-storage-unsupported"))}),this.pollUserCancellation()}get eventId(){var e;return((e=this.authWindow)==null?void 0:e.associatedEvent)||null}cancel(){this.reject(Zt(this.auth,"cancelled-popup-request"))}cleanUp(){this.authWindow&&this.authWindow.close(),this.pollId&&window.clearTimeout(this.pollId),this.authWindow=null,this.pollId=null,Os.currentPopupAction=null}pollUserCancellation(){const e=()=>{var t,r;if((r=(t=this.authWindow)==null?void 0:t.window)!=null&&r.closed){this.pollId=window.setTimeout(()=>{this.pollId=null,this.reject(Zt(this.auth,"popup-closed-by-user"))},8e3);return}this.pollId=window.setTimeout(e,UA.get())};e()}}Os.currentPopupAction=null;/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const $A="pendingRedirect",ja=new Map;class qA extends vg{constructor(e,t,r=!1){super(e,["signInViaRedirect","linkViaRedirect","reauthViaRedirect","unknown"],t,void 0,r),this.eventId=null}async execute(){let e=ja.get(this.auth._key());if(!e){try{const r=await jA(this.resolver,this.auth)?await super.execute():null;e=()=>Promise.resolve(r)}catch(t){e=()=>Promise.reject(t)}ja.set(this.auth._key(),e)}return this.bypassAuthState||ja.set(this.auth._key(),()=>Promise.resolve(null)),e()}async onAuthEvent(e){if(e.type==="signInViaRedirect")return super.onAuthEvent(e);if(e.type==="unknown"){this.resolve(null);return}if(e.eventId){const t=await this.auth._redirectUserForId(e.eventId);if(t)return this.user=t,super.onAuthEvent(e);this.resolve(null)}}async onExecution(){}cleanUp(){}}async function jA(n,e){const t=KA(e),r=zA(n);if(!await r._isAvailable())return!1;const s=await r._get(t)==="true";return await r._remove(t),s}function GA(n,e){ja.set(n._key(),e)}function zA(n){return pn(n._redirectPersistence)}function KA(n){return qa($A,n.config.apiKey,n.name)}async function WA(n,e,t=!1){if(Ct(n.app))return Promise.reject(sr(n));const r=cs(n),s=MA(r,e),o=await new qA(r,s,t).execute();return o&&!t&&(delete o.user._redirectEventId,await r._persistUserIfCurrent(o.user),await r._setRedirectUser(null,e)),o}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const HA=600*1e3;class QA{constructor(e){this.auth=e,this.cachedEventUids=new Set,this.consumers=new Set,this.queuedRedirectEvent=null,this.hasHandledPotentialRedirect=!1,this.lastProcessedEventTime=Date.now()}registerConsumer(e){this.consumers.add(e),this.queuedRedirectEvent&&this.isEventForConsumer(this.queuedRedirectEvent,e)&&(this.sendToConsumer(this.queuedRedirectEvent,e),this.saveEventToCache(this.queuedRedirectEvent),this.queuedRedirectEvent=null)}unregisterConsumer(e){this.consumers.delete(e)}onEvent(e){if(this.hasEventBeenHandled(e))return!1;let t=!1;return this.consumers.forEach(r=>{this.isEventForConsumer(e,r)&&(t=!0,this.sendToConsumer(e,r),this.saveEventToCache(e))}),this.hasHandledPotentialRedirect||!JA(e)||(this.hasHandledPotentialRedirect=!0,t||(this.queuedRedirectEvent=e,t=!0)),t}sendToConsumer(e,t){var r;if(e.error&&!bg(e)){const s=((r=e.error.code)==null?void 0:r.split("auth/")[1])||"internal-error";t.onError(Zt(this.auth,s))}else t.onAuthEvent(e)}isEventForConsumer(e,t){const r=t.eventId===null||!!e.eventId&&e.eventId===t.eventId;return t.filter.includes(e.type)&&r}hasEventBeenHandled(e){return Date.now()-this.lastProcessedEventTime>=HA&&this.cachedEventUids.clear(),this.cachedEventUids.has(Of(e))}saveEventToCache(e){this.cachedEventUids.add(Of(e)),this.lastProcessedEventTime=Date.now()}}function Of(n){return[n.type,n.eventId,n.sessionId,n.tenantId].filter(e=>e).join("-")}function bg({type:n,error:e}){return n==="unknown"&&(e==null?void 0:e.code)==="auth/no-auth-event"}function JA(n){switch(n.type){case"signInViaRedirect":case"linkViaRedirect":case"reauthViaRedirect":return!0;case"unknown":return bg(n);default:return!1}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function YA(n,e={}){return vn(n,"GET","/v1/projects",e)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const XA=/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,ZA=/^https?/;async function ev(n){if(n.config.emulator)return;const{authorizedDomains:e}=await YA(n);for(const t of e)try{if(tv(t))return}catch{}Ft(n,"unauthorized-domain")}function tv(n){const e=sl(),{protocol:t,hostname:r}=new URL(e);if(n.startsWith("chrome-extension://")){const o=new URL(n);return o.hostname===""&&r===""?t==="chrome-extension:"&&n.replace("chrome-extension://","")===e.replace("chrome-extension://",""):t==="chrome-extension:"&&o.hostname===r}if(!ZA.test(t))return!1;if(XA.test(n))return r===n;const s=n.replace(/\./g,"\\.");return new RegExp("^(.+\\."+s+"|"+s+")$","i").test(r)}/**
 * @license
 * Copyright 2020 Google LLC.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const nv=new Yo(3e4,6e4);function xf(){const n=en().___jsl;if(n!=null&&n.H){for(const e of Object.keys(n.H))if(n.H[e].r=n.H[e].r||[],n.H[e].L=n.H[e].L||[],n.H[e].r=[...n.H[e].L],n.CP)for(let t=0;t<n.CP.length;t++)n.CP[t]=null}}function rv(n){return new Promise((e,t)=>{var s,i,o;function r(){xf(),gapi.load("gapi.iframes",{callback:()=>{e(gapi.iframes.getContext())},ontimeout:()=>{xf(),t(Zt(n,"network-request-failed"))},timeout:nv.get()})}if((i=(s=en().gapi)==null?void 0:s.iframes)!=null&&i.Iframe)e(gapi.iframes.getContext());else if((o=en().gapi)!=null&&o.load)r();else{const a=JT("iframefcb");return en()[a]=()=>{gapi.load?r():t(Zt(n,"network-request-failed"))},ug(`${QT()}?onload=${a}`).catch(u=>t(u))}}).catch(e=>{throw Ga=null,e})}let Ga=null;function sv(n){return Ga=Ga||rv(n),Ga}/**
 * @license
 * Copyright 2020 Google LLC.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const iv=new Yo(5e3,15e3),ov="__/auth/iframe",av="emulator/auth/iframe",cv={style:{position:"absolute",top:"-100px",width:"1px",height:"1px"},"aria-hidden":"true",tabindex:"-1"},uv=new Map([["identitytoolkit.googleapis.com","p"],["staging-identitytoolkit.sandbox.googleapis.com","s"],["test-identitytoolkit.sandbox.googleapis.com","t"]]);function lv(n){const e=n.config;ee(e.authDomain,n,"auth-domain-config-required");const t=e.emulator?Kl(e,av):`https://${n.config.authDomain}/${ov}`,r={apiKey:e.apiKey,appName:n.name,v:as},s=uv.get(n.config.apiHost);s&&(r.eid=s);const i=n._getFrameworks();return i.length&&(r.fw=i.join(",")),`${t}?${Jo(r).slice(1)}`}async function hv(n){const e=await sv(n),t=en().gapi;return ee(t,n,"internal-error"),e.open({where:document.body,url:lv(n),messageHandlersFilter:t.iframes.CROSS_ORIGIN_IFRAMES_FILTER,attributes:cv,dontclear:!0},r=>new Promise(async(s,i)=>{await r.restyle({setHideOnLeave:!1});const o=Zt(n,"network-request-failed"),a=en().setTimeout(()=>{i(o)},iv.get());function u(){en().clearTimeout(a),s(r)}r.ping(u).then(u,()=>{i(o)})}))}/**
 * @license
 * Copyright 2020 Google LLC.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const dv={location:"yes",resizable:"yes",statusbar:"yes",toolbar:"no"},fv=500,mv=600,pv="_blank",gv="http://localhost";class Mf{constructor(e){this.window=e,this.associatedEvent=null}close(){if(this.window)try{this.window.close()}catch{}}}function _v(n,e,t,r=fv,s=mv){const i=Math.max((window.screen.availHeight-s)/2,0).toString(),o=Math.max((window.screen.availWidth-r)/2,0).toString();let a="";const u={...dv,width:r.toString(),height:s.toString(),top:i,left:o},l=Ye().toLowerCase();t&&(a=ng(l)?pv:t),eg(l)&&(e=e||gv,u.scrollbars="yes");const h=Object.entries(u).reduce((p,[_,w])=>`${p}${_}=${w},`,"");if(UT(l)&&a!=="_self")return yv(e||"",a),new Mf(null);const f=window.open(e||"",a,h);ee(f,n,"popup-blocked");try{f.focus()}catch{}return new Mf(f)}function yv(n,e){const t=document.createElement("a");t.href=n,t.target=e;const r=document.createEvent("MouseEvent");r.initMouseEvent("click",!0,!0,window,1,0,0,0,0,!1,!1,!1,!1,1,null),t.dispatchEvent(r)}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Iv="__/auth/handler",wv="emulator/auth/handler",Ev=encodeURIComponent("fac");async function Lf(n,e,t,r,s,i){ee(n.config.authDomain,n,"auth-domain-config-required"),ee(n.config.apiKey,n,"invalid-api-key");const o={apiKey:n.config.apiKey,appName:n.name,authType:t,redirectUrl:r,v:as,eventId:s};if(e instanceof dg){e.setDefaultLanguage(n.languageCode),o.providerId=e.providerId||"",oE(e.getCustomParameters())||(o.customParameters=JSON.stringify(e.getCustomParameters()));for(const[h,f]of Object.entries({}))o[h]=f}if(e instanceof Xo){const h=e.getScopes().filter(f=>f!=="");h.length>0&&(o.scopes=h.join(","))}n.tenantId&&(o.tid=n.tenantId);const a=o;for(const h of Object.keys(a))a[h]===void 0&&delete a[h];const u=await n._getAppCheckToken(),l=u?`#${Ev}=${encodeURIComponent(u)}`:"";return`${Tv(n)}?${Jo(a).slice(1)}${l}`}function Tv({config:n}){return n.emulator?Kl(n,wv):`https://${n.authDomain}/${Iv}`}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Bu="webStorageSupport";class Av{constructor(){this.eventManagers={},this.iframes={},this.originValidationPromises={},this._redirectPersistence=yg,this._completeRedirectFn=WA,this._overrideRedirectResult=GA}async _openPopup(e,t,r,s){var o;yn((o=this.eventManagers[e._key()])==null?void 0:o.manager,"_initialize() not called before _openPopup()");const i=await Lf(e,t,r,sl(),s);return _v(e,i,Yl())}async _openRedirect(e,t,r,s){await this._originValidation(e);const i=await Lf(e,t,r,sl(),s);return SA(i),new Promise(()=>{})}_initialize(e){const t=e._key();if(this.eventManagers[t]){const{manager:s,promise:i}=this.eventManagers[t];return s?Promise.resolve(s):(yn(i,"If manager is not set, promise should be"),i)}const r=this.initAndGetManager(e);return this.eventManagers[t]={promise:r},r.catch(()=>{delete this.eventManagers[t]}),r}async initAndGetManager(e){const t=await hv(e),r=new QA(e);return t.register("authEvent",s=>(ee(s==null?void 0:s.authEvent,e,"invalid-auth-event"),{status:r.onEvent(s.authEvent)?"ACK":"ERROR"}),gapi.iframes.CROSS_ORIGIN_IFRAMES_FILTER),this.eventManagers[e._key()]={manager:r},this.iframes[e._key()]=t,r}_isIframeWebStorageSupported(e,t){this.iframes[e._key()].send(Bu,{type:Bu},s=>{var o;const i=(o=s==null?void 0:s[0])==null?void 0:o[Bu];i!==void 0&&t(!!i),Ft(e,"internal-error")},gapi.iframes.CROSS_ORIGIN_IFRAMES_FILTER)}_originValidation(e){const t=e._key();return this.originValidationPromises[t]||(this.originValidationPromises[t]=ev(e)),this.originValidationPromises[t]}get _shouldInitProactively(){return ag()||tg()||Hl()}}const vv=Av;var Bf="@firebase/auth",Ff="1.13.2";/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class bv{constructor(e){this.auth=e,this.internalListeners=new Map}getUid(){var e;return this.assertAuthConfigured(),((e=this.auth.currentUser)==null?void 0:e.uid)||null}async getToken(e){return this.assertAuthConfigured(),await this.auth._initializationPromise,this.auth.currentUser?{accessToken:await this.auth.currentUser.getIdToken(e)}:null}addAuthTokenListener(e){if(this.assertAuthConfigured(),this.internalListeners.has(e))return;const t=this.auth.onIdTokenChanged(r=>{e((r==null?void 0:r.stsTokenManager.accessToken)||null)});this.internalListeners.set(e,t),this.updateProactiveRefresh()}removeAuthTokenListener(e){this.assertAuthConfigured();const t=this.internalListeners.get(e);t&&(this.internalListeners.delete(e),t(),this.updateProactiveRefresh())}assertAuthConfigured(){ee(this.auth._initializationPromise,"dependent-sdk-initialized-before-auth")}updateProactiveRefresh(){this.internalListeners.size>0?this.auth._startProactiveRefresh():this.auth._stopProactiveRefresh()}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Sv(n){switch(n){case"Node":return"node";case"ReactNative":return"rn";case"Worker":return"webworker";case"Cordova":return"cordova";case"WebExtension":return"web-extension";default:return}}function Rv(n){Wr(new ar("auth",(e,{options:t})=>{const r=e.getProvider("app").getImmediate(),s=e.getProvider("heartbeat"),i=e.getProvider("app-check-internal"),{apiKey:o,authDomain:a}=r.options;ee(o&&!o.includes(":"),"invalid-api-key",{appName:r.name});const u={apiKey:o,authDomain:a,clientPlatform:n,apiHost:"identitytoolkit.googleapis.com",tokenApiHost:"securetoken.googleapis.com",apiScheme:"https",sdkClientVersion:cg(n)},l=new KT(r,s,i,u);return nA(l,t),l},"PUBLIC").setInstantiationMode("EXPLICIT").setInstanceCreatedCallback((e,t,r)=>{e.getProvider("auth-internal").initialize()})),Wr(new ar("auth-internal",e=>{const t=cs(e.getProvider("auth").getImmediate());return(r=>new bv(r))(t)},"PRIVATE").setInstantiationMode("EXPLICIT")),Xt(Bf,Ff,Sv(n)),Xt(Bf,Ff,"esm2020")}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Pv=300,kv=xp("authIdTokenMaxAge")||Pv;let Uf=null;const Cv=n=>async e=>{const t=e&&await e.getIdTokenResult(),r=t&&(new Date().getTime()-Date.parse(t.issuedAtTime))/1e3;if(r&&r>kv)return;const s=t==null?void 0:t.token;Uf!==s&&(Uf=s,await fetch(n,{method:s?"POST":"DELETE",headers:s?{Authorization:`Bearer ${s}`}:{}}))};function Nv(n=Vc()){const e=fi(n,"auth");if(e.isInitialized())return e.getImmediate();const t=tA(n,{popupRedirectResolver:vv,persistence:[xA,AA,yg]}),r=xp("authTokenSyncURL");if(r&&typeof isSecureContext=="boolean"&&isSecureContext){const i=new URL(r,location.origin);if(location.origin===i.origin){const o=Cv(i.toString());wA(t,o,()=>o(t.currentUser)),IA(t,a=>o(a))}}const s=Dp("auth");return s&&rA(t,`http://${s}`),t}function Dv(){var n;return((n=document.getElementsByTagName("head"))==null?void 0:n[0])??document}WT({loadJS(n){return new Promise((e,t)=>{const r=document.createElement("script");r.setAttribute("src",n),r.onload=e,r.onerror=s=>{const i=Zt("internal-error");i.customData=s,t(i)},r.type="text/javascript",r.charset="UTF-8",Dv().appendChild(r)})},gapiScript:"https://apis.google.com/js/api.js",recaptchaV2Script:"https://www.google.com/recaptcha/api.js",recaptchaEnterpriseScript:"https://www.google.com/recaptcha/enterprise.js?render="});Rv("Browser");var $f=typeof globalThis<"u"?globalThis:typeof window<"u"?window:typeof global<"u"?global:typeof self<"u"?self:{};/** @license
Copyright The Closure Library Authors.
SPDX-License-Identifier: Apache-2.0
*/var ir,Sg;(function(){var n;/** @license

 Copyright The Closure Library Authors.
 SPDX-License-Identifier: Apache-2.0
*/function e(T,y){function E(){}E.prototype=y.prototype,T.F=y.prototype,T.prototype=new E,T.prototype.constructor=T,T.D=function(v,A,P){for(var I=Array(arguments.length-2),ot=2;ot<arguments.length;ot++)I[ot-2]=arguments[ot];return y.prototype[A].apply(v,I)}}function t(){this.blockSize=-1}function r(){this.blockSize=-1,this.blockSize=64,this.g=Array(4),this.C=Array(this.blockSize),this.o=this.h=0,this.u()}e(r,t),r.prototype.u=function(){this.g[0]=1732584193,this.g[1]=4023233417,this.g[2]=2562383102,this.g[3]=271733878,this.o=this.h=0};function s(T,y,E){E||(E=0);const v=Array(16);if(typeof y=="string")for(var A=0;A<16;++A)v[A]=y.charCodeAt(E++)|y.charCodeAt(E++)<<8|y.charCodeAt(E++)<<16|y.charCodeAt(E++)<<24;else for(A=0;A<16;++A)v[A]=y[E++]|y[E++]<<8|y[E++]<<16|y[E++]<<24;y=T.g[0],E=T.g[1],A=T.g[2];let P=T.g[3],I;I=y+(P^E&(A^P))+v[0]+3614090360&4294967295,y=E+(I<<7&4294967295|I>>>25),I=P+(A^y&(E^A))+v[1]+3905402710&4294967295,P=y+(I<<12&4294967295|I>>>20),I=A+(E^P&(y^E))+v[2]+606105819&4294967295,A=P+(I<<17&4294967295|I>>>15),I=E+(y^A&(P^y))+v[3]+3250441966&4294967295,E=A+(I<<22&4294967295|I>>>10),I=y+(P^E&(A^P))+v[4]+4118548399&4294967295,y=E+(I<<7&4294967295|I>>>25),I=P+(A^y&(E^A))+v[5]+1200080426&4294967295,P=y+(I<<12&4294967295|I>>>20),I=A+(E^P&(y^E))+v[6]+2821735955&4294967295,A=P+(I<<17&4294967295|I>>>15),I=E+(y^A&(P^y))+v[7]+4249261313&4294967295,E=A+(I<<22&4294967295|I>>>10),I=y+(P^E&(A^P))+v[8]+1770035416&4294967295,y=E+(I<<7&4294967295|I>>>25),I=P+(A^y&(E^A))+v[9]+2336552879&4294967295,P=y+(I<<12&4294967295|I>>>20),I=A+(E^P&(y^E))+v[10]+4294925233&4294967295,A=P+(I<<17&4294967295|I>>>15),I=E+(y^A&(P^y))+v[11]+2304563134&4294967295,E=A+(I<<22&4294967295|I>>>10),I=y+(P^E&(A^P))+v[12]+1804603682&4294967295,y=E+(I<<7&4294967295|I>>>25),I=P+(A^y&(E^A))+v[13]+4254626195&4294967295,P=y+(I<<12&4294967295|I>>>20),I=A+(E^P&(y^E))+v[14]+2792965006&4294967295,A=P+(I<<17&4294967295|I>>>15),I=E+(y^A&(P^y))+v[15]+1236535329&4294967295,E=A+(I<<22&4294967295|I>>>10),I=y+(A^P&(E^A))+v[1]+4129170786&4294967295,y=E+(I<<5&4294967295|I>>>27),I=P+(E^A&(y^E))+v[6]+3225465664&4294967295,P=y+(I<<9&4294967295|I>>>23),I=A+(y^E&(P^y))+v[11]+643717713&4294967295,A=P+(I<<14&4294967295|I>>>18),I=E+(P^y&(A^P))+v[0]+3921069994&4294967295,E=A+(I<<20&4294967295|I>>>12),I=y+(A^P&(E^A))+v[5]+3593408605&4294967295,y=E+(I<<5&4294967295|I>>>27),I=P+(E^A&(y^E))+v[10]+38016083&4294967295,P=y+(I<<9&4294967295|I>>>23),I=A+(y^E&(P^y))+v[15]+3634488961&4294967295,A=P+(I<<14&4294967295|I>>>18),I=E+(P^y&(A^P))+v[4]+3889429448&4294967295,E=A+(I<<20&4294967295|I>>>12),I=y+(A^P&(E^A))+v[9]+568446438&4294967295,y=E+(I<<5&4294967295|I>>>27),I=P+(E^A&(y^E))+v[14]+3275163606&4294967295,P=y+(I<<9&4294967295|I>>>23),I=A+(y^E&(P^y))+v[3]+4107603335&4294967295,A=P+(I<<14&4294967295|I>>>18),I=E+(P^y&(A^P))+v[8]+1163531501&4294967295,E=A+(I<<20&4294967295|I>>>12),I=y+(A^P&(E^A))+v[13]+2850285829&4294967295,y=E+(I<<5&4294967295|I>>>27),I=P+(E^A&(y^E))+v[2]+4243563512&4294967295,P=y+(I<<9&4294967295|I>>>23),I=A+(y^E&(P^y))+v[7]+1735328473&4294967295,A=P+(I<<14&4294967295|I>>>18),I=E+(P^y&(A^P))+v[12]+2368359562&4294967295,E=A+(I<<20&4294967295|I>>>12),I=y+(E^A^P)+v[5]+4294588738&4294967295,y=E+(I<<4&4294967295|I>>>28),I=P+(y^E^A)+v[8]+2272392833&4294967295,P=y+(I<<11&4294967295|I>>>21),I=A+(P^y^E)+v[11]+1839030562&4294967295,A=P+(I<<16&4294967295|I>>>16),I=E+(A^P^y)+v[14]+4259657740&4294967295,E=A+(I<<23&4294967295|I>>>9),I=y+(E^A^P)+v[1]+2763975236&4294967295,y=E+(I<<4&4294967295|I>>>28),I=P+(y^E^A)+v[4]+1272893353&4294967295,P=y+(I<<11&4294967295|I>>>21),I=A+(P^y^E)+v[7]+4139469664&4294967295,A=P+(I<<16&4294967295|I>>>16),I=E+(A^P^y)+v[10]+3200236656&4294967295,E=A+(I<<23&4294967295|I>>>9),I=y+(E^A^P)+v[13]+681279174&4294967295,y=E+(I<<4&4294967295|I>>>28),I=P+(y^E^A)+v[0]+3936430074&4294967295,P=y+(I<<11&4294967295|I>>>21),I=A+(P^y^E)+v[3]+3572445317&4294967295,A=P+(I<<16&4294967295|I>>>16),I=E+(A^P^y)+v[6]+76029189&4294967295,E=A+(I<<23&4294967295|I>>>9),I=y+(E^A^P)+v[9]+3654602809&4294967295,y=E+(I<<4&4294967295|I>>>28),I=P+(y^E^A)+v[12]+3873151461&4294967295,P=y+(I<<11&4294967295|I>>>21),I=A+(P^y^E)+v[15]+530742520&4294967295,A=P+(I<<16&4294967295|I>>>16),I=E+(A^P^y)+v[2]+3299628645&4294967295,E=A+(I<<23&4294967295|I>>>9),I=y+(A^(E|~P))+v[0]+4096336452&4294967295,y=E+(I<<6&4294967295|I>>>26),I=P+(E^(y|~A))+v[7]+1126891415&4294967295,P=y+(I<<10&4294967295|I>>>22),I=A+(y^(P|~E))+v[14]+2878612391&4294967295,A=P+(I<<15&4294967295|I>>>17),I=E+(P^(A|~y))+v[5]+4237533241&4294967295,E=A+(I<<21&4294967295|I>>>11),I=y+(A^(E|~P))+v[12]+1700485571&4294967295,y=E+(I<<6&4294967295|I>>>26),I=P+(E^(y|~A))+v[3]+2399980690&4294967295,P=y+(I<<10&4294967295|I>>>22),I=A+(y^(P|~E))+v[10]+4293915773&4294967295,A=P+(I<<15&4294967295|I>>>17),I=E+(P^(A|~y))+v[1]+2240044497&4294967295,E=A+(I<<21&4294967295|I>>>11),I=y+(A^(E|~P))+v[8]+1873313359&4294967295,y=E+(I<<6&4294967295|I>>>26),I=P+(E^(y|~A))+v[15]+4264355552&4294967295,P=y+(I<<10&4294967295|I>>>22),I=A+(y^(P|~E))+v[6]+2734768916&4294967295,A=P+(I<<15&4294967295|I>>>17),I=E+(P^(A|~y))+v[13]+1309151649&4294967295,E=A+(I<<21&4294967295|I>>>11),I=y+(A^(E|~P))+v[4]+4149444226&4294967295,y=E+(I<<6&4294967295|I>>>26),I=P+(E^(y|~A))+v[11]+3174756917&4294967295,P=y+(I<<10&4294967295|I>>>22),I=A+(y^(P|~E))+v[2]+718787259&4294967295,A=P+(I<<15&4294967295|I>>>17),I=E+(P^(A|~y))+v[9]+3951481745&4294967295,T.g[0]=T.g[0]+y&4294967295,T.g[1]=T.g[1]+(A+(I<<21&4294967295|I>>>11))&4294967295,T.g[2]=T.g[2]+A&4294967295,T.g[3]=T.g[3]+P&4294967295}r.prototype.v=function(T,y){y===void 0&&(y=T.length);const E=y-this.blockSize,v=this.C;let A=this.h,P=0;for(;P<y;){if(A==0)for(;P<=E;)s(this,T,P),P+=this.blockSize;if(typeof T=="string"){for(;P<y;)if(v[A++]=T.charCodeAt(P++),A==this.blockSize){s(this,v),A=0;break}}else for(;P<y;)if(v[A++]=T[P++],A==this.blockSize){s(this,v),A=0;break}}this.h=A,this.o+=y},r.prototype.A=function(){var T=Array((this.h<56?this.blockSize:this.blockSize*2)-this.h);T[0]=128;for(var y=1;y<T.length-8;++y)T[y]=0;y=this.o*8;for(var E=T.length-8;E<T.length;++E)T[E]=y&255,y/=256;for(this.v(T),T=Array(16),y=0,E=0;E<4;++E)for(let v=0;v<32;v+=8)T[y++]=this.g[E]>>>v&255;return T};function i(T,y){var E=a;return Object.prototype.hasOwnProperty.call(E,T)?E[T]:E[T]=y(T)}function o(T,y){this.h=y;const E=[];let v=!0;for(let A=T.length-1;A>=0;A--){const P=T[A]|0;v&&P==y||(E[A]=P,v=!1)}this.g=E}var a={};function u(T){return-128<=T&&T<128?i(T,function(y){return new o([y|0],y<0?-1:0)}):new o([T|0],T<0?-1:0)}function l(T){if(isNaN(T)||!isFinite(T))return f;if(T<0)return C(l(-T));const y=[];let E=1;for(let v=0;T>=E;v++)y[v]=T/E|0,E*=4294967296;return new o(y,0)}function h(T,y){if(T.length==0)throw Error("number format error: empty string");if(y=y||10,y<2||36<y)throw Error("radix out of range: "+y);if(T.charAt(0)=="-")return C(h(T.substring(1),y));if(T.indexOf("-")>=0)throw Error('number format error: interior "-" character');const E=l(Math.pow(y,8));let v=f;for(let P=0;P<T.length;P+=8){var A=Math.min(8,T.length-P);const I=parseInt(T.substring(P,P+A),y);A<8?(A=l(Math.pow(y,A)),v=v.j(A).add(l(I))):(v=v.j(E),v=v.add(l(I)))}return v}var f=u(0),p=u(1),_=u(16777216);n=o.prototype,n.m=function(){if(b(this))return-C(this).m();let T=0,y=1;for(let E=0;E<this.g.length;E++){const v=this.i(E);T+=(v>=0?v:4294967296+v)*y,y*=4294967296}return T},n.toString=function(T){if(T=T||10,T<2||36<T)throw Error("radix out of range: "+T);if(w(this))return"0";if(b(this))return"-"+C(this).toString(T);const y=l(Math.pow(T,6));var E=this;let v="";for(;;){const A=z(E,y).g;E=V(E,A.j(y));let P=((E.g.length>0?E.g[0]:E.h)>>>0).toString(T);if(E=A,w(E))return P+v;for(;P.length<6;)P="0"+P;v=P+v}},n.i=function(T){return T<0?0:T<this.g.length?this.g[T]:this.h};function w(T){if(T.h!=0)return!1;for(let y=0;y<T.g.length;y++)if(T.g[y]!=0)return!1;return!0}function b(T){return T.h==-1}n.l=function(T){return T=V(this,T),b(T)?-1:w(T)?0:1};function C(T){const y=T.g.length,E=[];for(let v=0;v<y;v++)E[v]=~T.g[v];return new o(E,~T.h).add(p)}n.abs=function(){return b(this)?C(this):this},n.add=function(T){const y=Math.max(this.g.length,T.g.length),E=[];let v=0;for(let A=0;A<=y;A++){let P=v+(this.i(A)&65535)+(T.i(A)&65535),I=(P>>>16)+(this.i(A)>>>16)+(T.i(A)>>>16);v=I>>>16,P&=65535,I&=65535,E[A]=I<<16|P}return new o(E,E[E.length-1]&-2147483648?-1:0)};function V(T,y){return T.add(C(y))}n.j=function(T){if(w(this)||w(T))return f;if(b(this))return b(T)?C(this).j(C(T)):C(C(this).j(T));if(b(T))return C(this.j(C(T)));if(this.l(_)<0&&T.l(_)<0)return l(this.m()*T.m());const y=this.g.length+T.g.length,E=[];for(var v=0;v<2*y;v++)E[v]=0;for(v=0;v<this.g.length;v++)for(let A=0;A<T.g.length;A++){const P=this.i(v)>>>16,I=this.i(v)&65535,ot=T.i(A)>>>16,Dt=T.i(A)&65535;E[2*v+2*A]+=I*Dt,O(E,2*v+2*A),E[2*v+2*A+1]+=P*Dt,O(E,2*v+2*A+1),E[2*v+2*A+1]+=I*ot,O(E,2*v+2*A+1),E[2*v+2*A+2]+=P*ot,O(E,2*v+2*A+2)}for(T=0;T<y;T++)E[T]=E[2*T+1]<<16|E[2*T];for(T=y;T<2*y;T++)E[T]=0;return new o(E,0)};function O(T,y){for(;(T[y]&65535)!=T[y];)T[y+1]+=T[y]>>>16,T[y]&=65535,y++}function L(T,y){this.g=T,this.h=y}function z(T,y){if(w(y))throw Error("division by zero");if(w(T))return new L(f,f);if(b(T))return y=z(C(T),y),new L(C(y.g),C(y.h));if(b(y))return y=z(T,C(y)),new L(C(y.g),y.h);if(T.g.length>30){if(b(T)||b(y))throw Error("slowDivide_ only works with positive integers.");for(var E=p,v=y;v.l(T)<=0;)E=ne(E),v=ne(v);var A=H(E,1),P=H(v,1);for(v=H(v,2),E=H(E,2);!w(v);){var I=P.add(v);I.l(T)<=0&&(A=A.add(E),P=I),v=H(v,1),E=H(E,1)}return y=V(T,A.j(y)),new L(A,y)}for(A=f;T.l(y)>=0;){for(E=Math.max(1,Math.floor(T.m()/y.m())),v=Math.ceil(Math.log(E)/Math.LN2),v=v<=48?1:Math.pow(2,v-48),P=l(E),I=P.j(y);b(I)||I.l(T)>0;)E-=v,P=l(E),I=P.j(y);w(P)&&(P=p),A=A.add(P),T=V(T,I)}return new L(A,T)}n.B=function(T){return z(this,T).h},n.and=function(T){const y=Math.max(this.g.length,T.g.length),E=[];for(let v=0;v<y;v++)E[v]=this.i(v)&T.i(v);return new o(E,this.h&T.h)},n.or=function(T){const y=Math.max(this.g.length,T.g.length),E=[];for(let v=0;v<y;v++)E[v]=this.i(v)|T.i(v);return new o(E,this.h|T.h)},n.xor=function(T){const y=Math.max(this.g.length,T.g.length),E=[];for(let v=0;v<y;v++)E[v]=this.i(v)^T.i(v);return new o(E,this.h^T.h)};function ne(T){const y=T.g.length+1,E=[];for(let v=0;v<y;v++)E[v]=T.i(v)<<1|T.i(v-1)>>>31;return new o(E,T.h)}function H(T,y){const E=y>>5;y%=32;const v=T.g.length-E,A=[];for(let P=0;P<v;P++)A[P]=y>0?T.i(P+E)>>>y|T.i(P+E+1)<<32-y:T.i(P+E);return new o(A,T.h)}r.prototype.digest=r.prototype.A,r.prototype.reset=r.prototype.u,r.prototype.update=r.prototype.v,Sg=r,o.prototype.add=o.prototype.add,o.prototype.multiply=o.prototype.j,o.prototype.modulo=o.prototype.B,o.prototype.compare=o.prototype.l,o.prototype.toNumber=o.prototype.m,o.prototype.toString=o.prototype.toString,o.prototype.getBits=o.prototype.i,o.fromNumber=l,o.fromString=h,ir=o}).apply(typeof $f<"u"?$f:typeof self<"u"?self:typeof window<"u"?window:{});var Ca=typeof globalThis<"u"?globalThis:typeof window<"u"?window:typeof global<"u"?global:typeof self<"u"?self:{};/** @license
Copyright The Closure Library Authors.
SPDX-License-Identifier: Apache-2.0
*/var Rg,lo,Pg,za,al,kg,Cg,Ng;(function(){var n,e=Object.defineProperty;function t(c){c=[typeof globalThis=="object"&&globalThis,c,typeof window=="object"&&window,typeof self=="object"&&self,typeof Ca=="object"&&Ca];for(var d=0;d<c.length;++d){var m=c[d];if(m&&m.Math==Math)return m}throw Error("Cannot find global object")}var r=t(this);function s(c,d){if(d)e:{var m=r;c=c.split(".");for(var g=0;g<c.length-1;g++){var R=c[g];if(!(R in m))break e;m=m[R]}c=c[c.length-1],g=m[c],d=d(g),d!=g&&d!=null&&e(m,c,{configurable:!0,writable:!0,value:d})}}s("Symbol.dispose",function(c){return c||Symbol("Symbol.dispose")}),s("Array.prototype.values",function(c){return c||function(){return this[Symbol.iterator]()}}),s("Object.entries",function(c){return c||function(d){var m=[],g;for(g in d)Object.prototype.hasOwnProperty.call(d,g)&&m.push([g,d[g]]);return m}});/** @license

 Copyright The Closure Library Authors.
 SPDX-License-Identifier: Apache-2.0
*/var i=i||{},o=this||self;function a(c){var d=typeof c;return d=="object"&&c!=null||d=="function"}function u(c,d,m){return c.call.apply(c.bind,arguments)}function l(c,d,m){return l=u,l.apply(null,arguments)}function h(c,d){var m=Array.prototype.slice.call(arguments,1);return function(){var g=m.slice();return g.push.apply(g,arguments),c.apply(this,g)}}function f(c,d){function m(){}m.prototype=d.prototype,c.Z=d.prototype,c.prototype=new m,c.prototype.constructor=c,c.Ob=function(g,R,N){for(var U=Array(arguments.length-2),ie=2;ie<arguments.length;ie++)U[ie-2]=arguments[ie];return d.prototype[R].apply(g,U)}}var p=typeof AsyncContext<"u"&&typeof AsyncContext.Snapshot=="function"?c=>c&&AsyncContext.Snapshot.wrap(c):c=>c;function _(c){const d=c.length;if(d>0){const m=Array(d);for(let g=0;g<d;g++)m[g]=c[g];return m}return[]}function w(c,d){for(let g=1;g<arguments.length;g++){const R=arguments[g];var m=typeof R;if(m=m!="object"?m:R?Array.isArray(R)?"array":m:"null",m=="array"||m=="object"&&typeof R.length=="number"){m=c.length||0;const N=R.length||0;c.length=m+N;for(let U=0;U<N;U++)c[m+U]=R[U]}else c.push(R)}}class b{constructor(d,m){this.i=d,this.j=m,this.h=0,this.g=null}get(){let d;return this.h>0?(this.h--,d=this.g,this.g=d.next,d.next=null):d=this.i(),d}}function C(c){o.setTimeout(()=>{throw c},0)}function V(){var c=T;let d=null;return c.g&&(d=c.g,c.g=c.g.next,c.g||(c.h=null),d.next=null),d}class O{constructor(){this.h=this.g=null}add(d,m){const g=L.get();g.set(d,m),this.h?this.h.next=g:this.g=g,this.h=g}}var L=new b(()=>new z,c=>c.reset());class z{constructor(){this.next=this.g=this.h=null}set(d,m){this.h=d,this.g=m,this.next=null}reset(){this.next=this.g=this.h=null}}let ne,H=!1,T=new O,y=()=>{const c=Promise.resolve(void 0);ne=()=>{c.then(E)}};function E(){for(var c;c=V();){try{c.h.call(c.g)}catch(m){C(m)}var d=L;d.j(c),d.h<100&&(d.h++,c.next=d.g,d.g=c)}H=!1}function v(){this.u=this.u,this.C=this.C}v.prototype.u=!1,v.prototype.dispose=function(){this.u||(this.u=!0,this.N())},v.prototype[Symbol.dispose]=function(){this.dispose()},v.prototype.N=function(){if(this.C)for(;this.C.length;)this.C.shift()()};function A(c,d){this.type=c,this.g=this.target=d,this.defaultPrevented=!1}A.prototype.h=function(){this.defaultPrevented=!0};var P=(function(){if(!o.addEventListener||!Object.defineProperty)return!1;var c=!1,d=Object.defineProperty({},"passive",{get:function(){c=!0}});try{const m=()=>{};o.addEventListener("test",m,d),o.removeEventListener("test",m,d)}catch{}return c})();function I(c){return/^[\s\xa0]*$/.test(c)}function ot(c,d){A.call(this,c?c.type:""),this.relatedTarget=this.g=this.target=null,this.button=this.screenY=this.screenX=this.clientY=this.clientX=0,this.key="",this.metaKey=this.shiftKey=this.altKey=this.ctrlKey=!1,this.state=null,this.pointerId=0,this.pointerType="",this.i=null,c&&this.init(c,d)}f(ot,A),ot.prototype.init=function(c,d){const m=this.type=c.type,g=c.changedTouches&&c.changedTouches.length?c.changedTouches[0]:null;this.target=c.target||c.srcElement,this.g=d,d=c.relatedTarget,d||(m=="mouseover"?d=c.fromElement:m=="mouseout"&&(d=c.toElement)),this.relatedTarget=d,g?(this.clientX=g.clientX!==void 0?g.clientX:g.pageX,this.clientY=g.clientY!==void 0?g.clientY:g.pageY,this.screenX=g.screenX||0,this.screenY=g.screenY||0):(this.clientX=c.clientX!==void 0?c.clientX:c.pageX,this.clientY=c.clientY!==void 0?c.clientY:c.pageY,this.screenX=c.screenX||0,this.screenY=c.screenY||0),this.button=c.button,this.key=c.key||"",this.ctrlKey=c.ctrlKey,this.altKey=c.altKey,this.shiftKey=c.shiftKey,this.metaKey=c.metaKey,this.pointerId=c.pointerId||0,this.pointerType=c.pointerType,this.state=c.state,this.i=c,c.defaultPrevented&&ot.Z.h.call(this)},ot.prototype.h=function(){ot.Z.h.call(this);const c=this.i;c.preventDefault?c.preventDefault():c.returnValue=!1};var Dt="closure_listenable_"+(Math.random()*1e6|0),Ut=0;function Ni(c,d,m,g,R){this.listener=c,this.proxy=null,this.src=d,this.type=m,this.capture=!!g,this.ha=R,this.key=++Ut,this.da=this.fa=!1}function wt(c){c.da=!0,c.listener=null,c.proxy=null,c.src=null,c.ha=null}function Nn(c,d,m){for(const g in c)d.call(m,c[g],g,c)}function gs(c,d){for(const m in c)d.call(void 0,c[m],m,c)}function Di(c){const d={};for(const m in c)d[m]=c[m];return d}const br="constructor hasOwnProperty isPrototypeOf propertyIsEnumerable toLocaleString toString valueOf".split(" ");function _a(c,d){let m,g;for(let R=1;R<arguments.length;R++){g=arguments[R];for(m in g)c[m]=g[m];for(let N=0;N<br.length;N++)m=br[N],Object.prototype.hasOwnProperty.call(g,m)&&(c[m]=g[m])}}function $t(c){this.src=c,this.g={},this.h=0}$t.prototype.add=function(c,d,m,g,R){const N=c.toString();c=this.g[N],c||(c=this.g[N]=[],this.h++);const U=hn(c,d,g,R);return U>-1?(d=c[U],m||(d.fa=!1)):(d=new Ni(d,this.src,N,!!g,R),d.fa=m,c.push(d)),d};function Sr(c,d){const m=d.type;if(m in c.g){var g=c.g[m],R=Array.prototype.indexOf.call(g,d,void 0),N;(N=R>=0)&&Array.prototype.splice.call(g,R,1),N&&(wt(d),c.g[m].length==0&&(delete c.g[m],c.h--))}}function hn(c,d,m,g){for(let R=0;R<c.length;++R){const N=c[R];if(!N.da&&N.listener==d&&N.capture==!!m&&N.ha==g)return R}return-1}var Vt="closure_lm_"+(Math.random()*1e6|0),de={};function se(c,d,m,g,R){if(Array.isArray(d)){for(let N=0;N<d.length;N++)se(c,d[N],m,g,R);return null}return m=Oi(m),c&&c[Dt]?c.J(d,m,a(g)?!!g.capture:!1,R):Vi(c,d,m,!1,g,R)}function Vi(c,d,m,g,R,N){if(!d)throw Error("Invalid event type");const U=a(R)?!!R.capture:!!R;let ie=Pe(c);if(ie||(c[Vt]=ie=new $t(c)),m=ie.add(d,m,g,U,N),m.proxy)return m;if(g=_s(),m.proxy=g,g.src=c,g.listener=m,c.addEventListener)P||(R=U),R===void 0&&(R=!1),c.addEventListener(d.toString(),g,R);else if(c.attachEvent)c.attachEvent(fe(d.toString()),g);else if(c.addListener&&c.removeListener)c.addListener(g);else throw Error("addEventListener and attachEvent are unavailable.");return m}function _s(){function c(m){return d.call(c.src,c.listener,m)}const d=Ad;return c}function mu(c,d,m,g,R){if(Array.isArray(d))for(var N=0;N<d.length;N++)mu(c,d[N],m,g,R);else g=a(g)?!!g.capture:!!g,m=Oi(m),c&&c[Dt]?(c=c.i,N=String(d).toString(),N in c.g&&(d=c.g[N],m=hn(d,m,g,R),m>-1&&(wt(d[m]),Array.prototype.splice.call(d,m,1),d.length==0&&(delete c.g[N],c.h--)))):c&&(c=Pe(c))&&(d=c.g[d.toString()],c=-1,d&&(c=hn(d,m,g,R)),(m=c>-1?d[c]:null)&&ys(m))}function ys(c){if(typeof c!="number"&&c&&!c.da){var d=c.src;if(d&&d[Dt])Sr(d.i,c);else{var m=c.type,g=c.proxy;d.removeEventListener?d.removeEventListener(m,g,c.capture):d.detachEvent?d.detachEvent(fe(m),g):d.addListener&&d.removeListener&&d.removeListener(g),(m=Pe(d))?(Sr(m,c),m.h==0&&(m.src=null,d[Vt]=null)):wt(c)}}}function fe(c){return c in de?de[c]:de[c]="on"+c}function Ad(c,d){if(c.da)c=!0;else{d=new ot(d,this);const m=c.listener,g=c.ha||c.src;c.fa&&ys(c),c=m.call(g,d)}return c}function Pe(c){return c=c[Vt],c instanceof $t?c:null}var Rr="__closure_events_fn_"+(Math.random()*1e9>>>0);function Oi(c){return typeof c=="function"?c:(c[Rr]||(c[Rr]=function(d){return c.handleEvent(d)}),c[Rr])}function Se(){v.call(this),this.i=new $t(this),this.M=this,this.G=null}f(Se,v),Se.prototype[Dt]=!0,Se.prototype.removeEventListener=function(c,d,m,g){mu(this,c,d,m,g)};function he(c,d){var m,g=c.G;if(g)for(m=[];g;g=g.G)m.push(g);if(c=c.M,g=d.type||d,typeof d=="string")d=new A(d,c);else if(d instanceof A)d.target=d.target||c;else{var R=d;d=new A(g,c),_a(d,R)}R=!0;let N,U;if(m)for(U=m.length-1;U>=0;U--)N=d.g=m[U],R=ft(N,g,!0,d)&&R;if(N=d.g=c,R=ft(N,g,!0,d)&&R,R=ft(N,g,!1,d)&&R,m)for(U=0;U<m.length;U++)N=d.g=m[U],R=ft(N,g,!1,d)&&R}Se.prototype.N=function(){if(Se.Z.N.call(this),this.i){var c=this.i;for(const d in c.g){const m=c.g[d];for(let g=0;g<m.length;g++)wt(m[g]);delete c.g[d],c.h--}}this.G=null},Se.prototype.J=function(c,d,m,g){return this.i.add(String(c),d,!1,m,g)},Se.prototype.K=function(c,d,m,g){return this.i.add(String(c),d,!0,m,g)};function ft(c,d,m,g){if(d=c.i.g[String(d)],!d)return!0;d=d.concat();let R=!0;for(let N=0;N<d.length;++N){const U=d[N];if(U&&!U.da&&U.capture==m){const ie=U.listener,Qe=U.ha||U.src;U.fa&&Sr(c.i,U),R=ie.call(Qe,g)!==!1&&R}}return R&&!g.defaultPrevented}function pu(c,d){if(typeof c!="function")if(c&&typeof c.handleEvent=="function")c=l(c.handleEvent,c);else throw Error("Invalid listener argument");return Number(d)>2147483647?-1:o.setTimeout(c,d||0)}function qt(c){c.g=pu(()=>{c.g=null,c.i&&(c.i=!1,qt(c))},c.l);const d=c.h;c.h=null,c.m.apply(null,d)}class gu extends v{constructor(d,m){super(),this.m=d,this.l=m,this.h=null,this.i=!1,this.g=null}j(d){this.h=arguments,this.g?this.i=!0:qt(this)}N(){super.N(),this.g&&(o.clearTimeout(this.g),this.g=null,this.i=!1,this.h=null)}}function Dn(c){v.call(this),this.h=c,this.g={}}f(Dn,v);var ya=[];function xi(c){Nn(c.g,function(d,m){this.g.hasOwnProperty(m)&&ys(d)},c),c.g={}}Dn.prototype.N=function(){Dn.Z.N.call(this),xi(this)},Dn.prototype.handleEvent=function(){throw Error("EventHandler.handleEvent not implemented")};var Is=o.JSON.stringify,_u=o.JSON.parse,Mi=class{stringify(c){return o.JSON.stringify(c,void 0)}parse(c){return o.JSON.parse(c,void 0)}};function Li(){}function Bi(){}var jt={OPEN:"a",hb:"b",ERROR:"c",tb:"d"};function Vn(){A.call(this,"d")}f(Vn,A);function Pr(){A.call(this,"c")}f(Pr,A);var dn={},ws=null;function kr(){return ws=ws||new Se}dn.Ia="serverreachability";function Fi(c){A.call(this,dn.Ia,c)}f(Fi,A);function On(c){const d=kr();he(d,new Fi(d))}dn.STAT_EVENT="statevent";function vd(c,d){A.call(this,dn.STAT_EVENT,c),this.stat=d}f(vd,A);function mt(c){const d=kr();he(d,new vd(d,c))}dn.Ja="timingevent";function bd(c,d){A.call(this,dn.Ja,c),this.size=d}f(bd,A);function Ui(c,d){if(typeof c!="function")throw Error("Fn must not be null and must be a function");return o.setTimeout(function(){c()},d)}function $i(){this.g=!0}$i.prototype.ua=function(){this.g=!1};function Ew(c,d,m,g,R,N){c.info(function(){if(c.g)if(N){var U="",ie=N.split("&");for(let Te=0;Te<ie.length;Te++){var Qe=ie[Te].split("=");if(Qe.length>1){const et=Qe[0];Qe=Qe[1];const zt=et.split("_");U=zt.length>=2&&zt[1]=="type"?U+(et+"="+Qe+"&"):U+(et+"=redacted&")}}}else U=null;else U=N;return"XMLHTTP REQ ("+g+") [attempt "+R+"]: "+d+`
`+m+`
`+U})}function Tw(c,d,m,g,R,N,U){c.info(function(){return"XMLHTTP RESP ("+g+") [ attempt "+R+"]: "+d+`
`+m+`
`+N+" "+U})}function Es(c,d,m,g){c.info(function(){return"XMLHTTP TEXT ("+d+"): "+vw(c,m)+(g?" "+g:"")})}function Aw(c,d){c.info(function(){return"TIMEOUT: "+d})}$i.prototype.info=function(){};function vw(c,d){if(!c.g)return d;if(!d)return null;try{const N=JSON.parse(d);if(N){for(c=0;c<N.length;c++)if(Array.isArray(N[c])){var m=N[c];if(!(m.length<2)){var g=m[1];if(Array.isArray(g)&&!(g.length<1)){var R=g[0];if(R!="noop"&&R!="stop"&&R!="close")for(let U=1;U<g.length;U++)g[U]=""}}}}return Is(N)}catch{return d}}var Ia={NO_ERROR:0,cb:1,qb:2,pb:3,kb:4,ob:5,rb:6,Ga:7,TIMEOUT:8,ub:9},Sd={ib:"complete",Fb:"success",ERROR:"error",Ga:"abort",xb:"ready",yb:"readystatechange",TIMEOUT:"timeout",sb:"incrementaldata",wb:"progress",lb:"downloadprogress",Nb:"uploadprogress"},Rd;function yu(){}f(yu,Li),yu.prototype.g=function(){return new XMLHttpRequest},Rd=new yu;function qi(c){return encodeURIComponent(String(c))}function bw(c){var d=1;c=c.split(":");const m=[];for(;d>0&&c.length;)m.push(c.shift()),d--;return c.length&&m.push(c.join(":")),m}function xn(c,d,m,g){this.j=c,this.i=d,this.l=m,this.S=g||1,this.V=new Dn(this),this.H=45e3,this.J=null,this.o=!1,this.u=this.B=this.A=this.M=this.F=this.T=this.D=null,this.G=[],this.g=null,this.C=0,this.m=this.v=null,this.X=-1,this.K=!1,this.P=0,this.O=null,this.W=this.L=this.U=this.R=!1,this.h=new Pd}function Pd(){this.i=null,this.g="",this.h=!1}var kd={},Iu={};function wu(c,d,m){c.M=1,c.A=Ea(Gt(d)),c.u=m,c.R=!0,Cd(c,null)}function Cd(c,d){c.F=Date.now(),wa(c),c.B=Gt(c.A);var m=c.B,g=c.S;Array.isArray(g)||(g=[String(g)]),jd(m.i,"t",g),c.C=0,m=c.j.L,c.h=new Pd,c.g=cf(c.j,m?d:null,!c.u),c.P>0&&(c.O=new gu(l(c.Y,c,c.g),c.P)),d=c.V,m=c.g,g=c.ba;var R="readystatechange";Array.isArray(R)||(R&&(ya[0]=R.toString()),R=ya);for(let N=0;N<R.length;N++){const U=se(m,R[N],g||d.handleEvent,!1,d.h||d);if(!U)break;d.g[U.key]=U}d=c.J?Di(c.J):{},c.u?(c.v||(c.v="POST"),d["Content-Type"]="application/x-www-form-urlencoded",c.g.ea(c.B,c.v,c.u,d)):(c.v="GET",c.g.ea(c.B,c.v,null,d)),On(),Ew(c.i,c.v,c.B,c.l,c.S,c.u)}xn.prototype.ba=function(c){c=c.target;const d=this.O;d&&Bn(c)==3?d.j():this.Y(c)},xn.prototype.Y=function(c){try{if(c==this.g)e:{const ie=Bn(this.g),Qe=this.g.ya(),Te=this.g.ca();if(!(ie<3)&&(ie!=3||this.g&&(this.h.h||this.g.la()||Jd(this.g)))){this.K||ie!=4||Qe==7||(Qe==8||Te<=0?On(3):On(2)),Eu(this);var d=this.g.ca();this.X=d;var m=Sw(this);if(this.o=d==200,Tw(this.i,this.v,this.B,this.l,this.S,ie,d),this.o){if(this.U&&!this.L){t:{if(this.g){var g,R=this.g;if((g=R.g?R.g.getResponseHeader("X-HTTP-Initial-Response"):null)&&!I(g)){var N=g;break t}}N=null}if(c=N)Es(this.i,this.l,c,"Initial handshake response via X-HTTP-Initial-Response"),this.L=!0,Tu(this,c);else{this.o=!1,this.m=3,mt(12),Cr(this),ji(this);break e}}if(this.R){c=!0;let et;for(;!this.K&&this.C<m.length;)if(et=Rw(this,m),et==Iu){ie==4&&(this.m=4,mt(14),c=!1),Es(this.i,this.l,null,"[Incomplete Response]");break}else if(et==kd){this.m=4,mt(15),Es(this.i,this.l,m,"[Invalid Chunk]"),c=!1;break}else Es(this.i,this.l,et,null),Tu(this,et);if(Nd(this)&&this.C!=0&&(this.h.g=this.h.g.slice(this.C),this.C=0),ie!=4||m.length!=0||this.h.h||(this.m=1,mt(16),c=!1),this.o=this.o&&c,!c)Es(this.i,this.l,m,"[Invalid Chunked Response]"),Cr(this),ji(this);else if(m.length>0&&!this.W){this.W=!0;var U=this.j;U.g==this&&U.aa&&!U.P&&(U.j.info("Great, no buffering proxy detected. Bytes received: "+m.length),Cu(U),U.P=!0,mt(11))}}else Es(this.i,this.l,m,null),Tu(this,m);ie==4&&Cr(this),this.o&&!this.K&&(ie==4?rf(this.j,this):(this.o=!1,wa(this)))}else $w(this.g),d==400&&m.indexOf("Unknown SID")>0?(this.m=3,mt(12)):(this.m=0,mt(13)),Cr(this),ji(this)}}}catch{}finally{}};function Sw(c){if(!Nd(c))return c.g.la();const d=Jd(c.g);if(d==="")return"";let m="";const g=d.length,R=Bn(c.g)==4;if(!c.h.i){if(typeof TextDecoder>"u")return Cr(c),ji(c),"";c.h.i=new o.TextDecoder}for(let N=0;N<g;N++)c.h.h=!0,m+=c.h.i.decode(d[N],{stream:!(R&&N==g-1)});return d.length=0,c.h.g+=m,c.C=0,c.h.g}function Nd(c){return c.g?c.v=="GET"&&c.M!=2&&c.j.Aa:!1}function Rw(c,d){var m=c.C,g=d.indexOf(`
`,m);return g==-1?Iu:(m=Number(d.substring(m,g)),isNaN(m)?kd:(g+=1,g+m>d.length?Iu:(d=d.slice(g,g+m),c.C=g+m,d)))}xn.prototype.cancel=function(){this.K=!0,Cr(this)};function wa(c){c.T=Date.now()+c.H,Dd(c,c.H)}function Dd(c,d){if(c.D!=null)throw Error("WatchDog timer not null");c.D=Ui(l(c.aa,c),d)}function Eu(c){c.D&&(o.clearTimeout(c.D),c.D=null)}xn.prototype.aa=function(){this.D=null;const c=Date.now();c-this.T>=0?(Aw(this.i,this.B),this.M!=2&&(On(),mt(17)),Cr(this),this.m=2,ji(this)):Dd(this,this.T-c)};function ji(c){c.j.I==0||c.K||rf(c.j,c)}function Cr(c){Eu(c);var d=c.O;d&&typeof d.dispose=="function"&&d.dispose(),c.O=null,xi(c.V),c.g&&(d=c.g,c.g=null,d.abort(),d.dispose())}function Tu(c,d){try{var m=c.j;if(m.I!=0&&(m.g==c||Au(m.h,c))){if(!c.L&&Au(m.h,c)&&m.I==3){try{var g=m.Ba.g.parse(d)}catch{g=null}if(Array.isArray(g)&&g.length==3){var R=g;if(R[0]==0){e:if(!m.v){if(m.g)if(m.g.F+3e3<c.F)Sa(m),va(m);else break e;ku(m),mt(18)}}else m.xa=R[1],0<m.xa-m.K&&R[2]<37500&&m.F&&m.A==0&&!m.C&&(m.C=Ui(l(m.Va,m),6e3));xd(m.h)<=1&&m.ta&&(m.ta=void 0)}else Dr(m,11)}else if((c.L||m.g==c)&&Sa(m),!I(d))for(R=m.Ba.g.parse(d),d=0;d<R.length;d++){let Te=R[d];const et=Te[0];if(!(et<=m.K))if(m.K=et,Te=Te[1],m.I==2)if(Te[0]=="c"){m.M=Te[1],m.ba=Te[2];const zt=Te[3];zt!=null&&(m.ka=zt,m.j.info("VER="+m.ka));const Vr=Te[4];Vr!=null&&(m.za=Vr,m.j.info("SVER="+m.za));const Fn=Te[5];Fn!=null&&typeof Fn=="number"&&Fn>0&&(g=1.5*Fn,m.O=g,m.j.info("backChannelRequestTimeoutMs_="+g)),g=m;const Un=c.g;if(Un){const Pa=Un.g?Un.g.getResponseHeader("X-Client-Wire-Protocol"):null;if(Pa){var N=g.h;N.g||Pa.indexOf("spdy")==-1&&Pa.indexOf("quic")==-1&&Pa.indexOf("h2")==-1||(N.j=N.l,N.g=new Set,N.h&&(vu(N,N.h),N.h=null))}if(g.G){const Nu=Un.g?Un.g.getResponseHeader("X-HTTP-Session-Id"):null;Nu&&(g.wa=Nu,ke(g.J,g.G,Nu))}}m.I=3,m.l&&m.l.ra(),m.aa&&(m.T=Date.now()-c.F,m.j.info("Handshake RTT: "+m.T+"ms")),g=m;var U=c;if(g.na=af(g,g.L?g.ba:null,g.W),U.L){Md(g.h,U);var ie=U,Qe=g.O;Qe&&(ie.H=Qe),ie.D&&(Eu(ie),wa(ie)),g.g=U}else tf(g);m.i.length>0&&ba(m)}else Te[0]!="stop"&&Te[0]!="close"||Dr(m,7);else m.I==3&&(Te[0]=="stop"||Te[0]=="close"?Te[0]=="stop"?Dr(m,7):Pu(m):Te[0]!="noop"&&m.l&&m.l.qa(Te),m.A=0)}}On(4)}catch{}}var Pw=class{constructor(c,d){this.g=c,this.map=d}};function Vd(c){this.l=c||10,o.PerformanceNavigationTiming?(c=o.performance.getEntriesByType("navigation"),c=c.length>0&&(c[0].nextHopProtocol=="hq"||c[0].nextHopProtocol=="h2")):c=!!(o.chrome&&o.chrome.loadTimes&&o.chrome.loadTimes()&&o.chrome.loadTimes().wasFetchedViaSpdy),this.j=c?this.l:1,this.g=null,this.j>1&&(this.g=new Set),this.h=null,this.i=[]}function Od(c){return c.h?!0:c.g?c.g.size>=c.j:!1}function xd(c){return c.h?1:c.g?c.g.size:0}function Au(c,d){return c.h?c.h==d:c.g?c.g.has(d):!1}function vu(c,d){c.g?c.g.add(d):c.h=d}function Md(c,d){c.h&&c.h==d?c.h=null:c.g&&c.g.has(d)&&c.g.delete(d)}Vd.prototype.cancel=function(){if(this.i=Ld(this),this.h)this.h.cancel(),this.h=null;else if(this.g&&this.g.size!==0){for(const c of this.g.values())c.cancel();this.g.clear()}};function Ld(c){if(c.h!=null)return c.i.concat(c.h.G);if(c.g!=null&&c.g.size!==0){let d=c.i;for(const m of c.g.values())d=d.concat(m.G);return d}return _(c.i)}var Bd=RegExp("^(?:([^:/?#.]+):)?(?://(?:([^\\\\/?#]*)@)?([^\\\\/?#]*?)(?::([0-9]+))?(?=[\\\\/?#]|$))?([^?#]+)?(?:\\?([^#]*))?(?:#([\\s\\S]*))?$");function kw(c,d){if(c){c=c.split("&");for(let m=0;m<c.length;m++){const g=c[m].indexOf("=");let R,N=null;g>=0?(R=c[m].substring(0,g),N=c[m].substring(g+1)):R=c[m],d(R,N?decodeURIComponent(N.replace(/\+/g," ")):"")}}}function Mn(c){this.g=this.o=this.j="",this.u=null,this.m=this.h="",this.l=!1;let d;c instanceof Mn?(this.l=c.l,Gi(this,c.j),this.o=c.o,this.g=c.g,zi(this,c.u),this.h=c.h,bu(this,Gd(c.i)),this.m=c.m):c&&(d=String(c).match(Bd))?(this.l=!1,Gi(this,d[1]||"",!0),this.o=Ki(d[2]||""),this.g=Ki(d[3]||"",!0),zi(this,d[4]),this.h=Ki(d[5]||"",!0),bu(this,d[6]||"",!0),this.m=Ki(d[7]||"")):(this.l=!1,this.i=new Hi(null,this.l))}Mn.prototype.toString=function(){const c=[];var d=this.j;d&&c.push(Wi(d,Fd,!0),":");var m=this.g;return(m||d=="file")&&(c.push("//"),(d=this.o)&&c.push(Wi(d,Fd,!0),"@"),c.push(qi(m).replace(/%25([0-9a-fA-F]{2})/g,"%$1")),m=this.u,m!=null&&c.push(":",String(m))),(m=this.h)&&(this.g&&m.charAt(0)!="/"&&c.push("/"),c.push(Wi(m,m.charAt(0)=="/"?Dw:Nw,!0))),(m=this.i.toString())&&c.push("?",m),(m=this.m)&&c.push("#",Wi(m,Ow)),c.join("")},Mn.prototype.resolve=function(c){const d=Gt(this);let m=!!c.j;m?Gi(d,c.j):m=!!c.o,m?d.o=c.o:m=!!c.g,m?d.g=c.g:m=c.u!=null;var g=c.h;if(m)zi(d,c.u);else if(m=!!c.h){if(g.charAt(0)!="/")if(this.g&&!this.h)g="/"+g;else{var R=d.h.lastIndexOf("/");R!=-1&&(g=d.h.slice(0,R+1)+g)}if(R=g,R==".."||R==".")g="";else if(R.indexOf("./")!=-1||R.indexOf("/.")!=-1){g=R.lastIndexOf("/",0)==0,R=R.split("/");const N=[];for(let U=0;U<R.length;){const ie=R[U++];ie=="."?g&&U==R.length&&N.push(""):ie==".."?((N.length>1||N.length==1&&N[0]!="")&&N.pop(),g&&U==R.length&&N.push("")):(N.push(ie),g=!0)}g=N.join("/")}else g=R}return m?d.h=g:m=c.i.toString()!=="",m?bu(d,Gd(c.i)):m=!!c.m,m&&(d.m=c.m),d};function Gt(c){return new Mn(c)}function Gi(c,d,m){c.j=m?Ki(d,!0):d,c.j&&(c.j=c.j.replace(/:$/,""))}function zi(c,d){if(d){if(d=Number(d),isNaN(d)||d<0)throw Error("Bad port number "+d);c.u=d}else c.u=null}function bu(c,d,m){d instanceof Hi?(c.i=d,xw(c.i,c.l)):(m||(d=Wi(d,Vw)),c.i=new Hi(d,c.l))}function ke(c,d,m){c.i.set(d,m)}function Ea(c){return ke(c,"zx",Math.floor(Math.random()*2147483648).toString(36)+Math.abs(Math.floor(Math.random()*2147483648)^Date.now()).toString(36)),c}function Ki(c,d){return c?d?decodeURI(c.replace(/%25/g,"%2525")):decodeURIComponent(c):""}function Wi(c,d,m){return typeof c=="string"?(c=encodeURI(c).replace(d,Cw),m&&(c=c.replace(/%25([0-9a-fA-F]{2})/g,"%$1")),c):null}function Cw(c){return c=c.charCodeAt(0),"%"+(c>>4&15).toString(16)+(c&15).toString(16)}var Fd=/[#\/\?@]/g,Nw=/[#\?:]/g,Dw=/[#\?]/g,Vw=/[#\?@]/g,Ow=/#/g;function Hi(c,d){this.h=this.g=null,this.i=c||null,this.j=!!d}function Nr(c){c.g||(c.g=new Map,c.h=0,c.i&&kw(c.i,function(d,m){c.add(decodeURIComponent(d.replace(/\+/g," ")),m)}))}n=Hi.prototype,n.add=function(c,d){Nr(this),this.i=null,c=Ts(this,c);let m=this.g.get(c);return m||this.g.set(c,m=[]),m.push(d),this.h+=1,this};function Ud(c,d){Nr(c),d=Ts(c,d),c.g.has(d)&&(c.i=null,c.h-=c.g.get(d).length,c.g.delete(d))}function $d(c,d){return Nr(c),d=Ts(c,d),c.g.has(d)}n.forEach=function(c,d){Nr(this),this.g.forEach(function(m,g){m.forEach(function(R){c.call(d,R,g,this)},this)},this)};function qd(c,d){Nr(c);let m=[];if(typeof d=="string")$d(c,d)&&(m=m.concat(c.g.get(Ts(c,d))));else for(c=Array.from(c.g.values()),d=0;d<c.length;d++)m=m.concat(c[d]);return m}n.set=function(c,d){return Nr(this),this.i=null,c=Ts(this,c),$d(this,c)&&(this.h-=this.g.get(c).length),this.g.set(c,[d]),this.h+=1,this},n.get=function(c,d){return c?(c=qd(this,c),c.length>0?String(c[0]):d):d};function jd(c,d,m){Ud(c,d),m.length>0&&(c.i=null,c.g.set(Ts(c,d),_(m)),c.h+=m.length)}n.toString=function(){if(this.i)return this.i;if(!this.g)return"";const c=[],d=Array.from(this.g.keys());for(let g=0;g<d.length;g++){var m=d[g];const R=qi(m);m=qd(this,m);for(let N=0;N<m.length;N++){let U=R;m[N]!==""&&(U+="="+qi(m[N])),c.push(U)}}return this.i=c.join("&")};function Gd(c){const d=new Hi;return d.i=c.i,c.g&&(d.g=new Map(c.g),d.h=c.h),d}function Ts(c,d){return d=String(d),c.j&&(d=d.toLowerCase()),d}function xw(c,d){d&&!c.j&&(Nr(c),c.i=null,c.g.forEach(function(m,g){const R=g.toLowerCase();g!=R&&(Ud(this,g),jd(this,R,m))},c)),c.j=d}function Mw(c,d){const m=new $i;if(o.Image){const g=new Image;g.onload=h(Ln,m,"TestLoadImage: loaded",!0,d,g),g.onerror=h(Ln,m,"TestLoadImage: error",!1,d,g),g.onabort=h(Ln,m,"TestLoadImage: abort",!1,d,g),g.ontimeout=h(Ln,m,"TestLoadImage: timeout",!1,d,g),o.setTimeout(function(){g.ontimeout&&g.ontimeout()},1e4),g.src=c}else d(!1)}function Lw(c,d){const m=new $i,g=new AbortController,R=setTimeout(()=>{g.abort(),Ln(m,"TestPingServer: timeout",!1,d)},1e4);fetch(c,{signal:g.signal}).then(N=>{clearTimeout(R),N.ok?Ln(m,"TestPingServer: ok",!0,d):Ln(m,"TestPingServer: server error",!1,d)}).catch(()=>{clearTimeout(R),Ln(m,"TestPingServer: error",!1,d)})}function Ln(c,d,m,g,R){try{R&&(R.onload=null,R.onerror=null,R.onabort=null,R.ontimeout=null),g(m)}catch{}}function Bw(){this.g=new Mi}function Su(c){this.i=c.Sb||null,this.h=c.ab||!1}f(Su,Li),Su.prototype.g=function(){return new Ta(this.i,this.h)};function Ta(c,d){Se.call(this),this.H=c,this.o=d,this.m=void 0,this.status=this.readyState=0,this.responseType=this.responseText=this.response=this.statusText="",this.onreadystatechange=null,this.A=new Headers,this.h=null,this.F="GET",this.D="",this.g=!1,this.B=this.j=this.l=null,this.v=new AbortController}f(Ta,Se),n=Ta.prototype,n.open=function(c,d){if(this.readyState!=0)throw this.abort(),Error("Error reopening a connection");this.F=c,this.D=d,this.readyState=1,Ji(this)},n.send=function(c){if(this.readyState!=1)throw this.abort(),Error("need to call open() first. ");if(this.v.signal.aborted)throw this.abort(),Error("Request was aborted.");this.g=!0;const d={headers:this.A,method:this.F,credentials:this.m,cache:void 0,signal:this.v.signal};c&&(d.body=c),(this.H||o).fetch(new Request(this.D,d)).then(this.Pa.bind(this),this.ga.bind(this))},n.abort=function(){this.response=this.responseText="",this.A=new Headers,this.status=0,this.v.abort(),this.j&&this.j.cancel("Request was aborted.").catch(()=>{}),this.readyState>=1&&this.g&&this.readyState!=4&&(this.g=!1,Qi(this)),this.readyState=0},n.Pa=function(c){if(this.g&&(this.l=c,this.h||(this.status=this.l.status,this.statusText=this.l.statusText,this.h=c.headers,this.readyState=2,Ji(this)),this.g&&(this.readyState=3,Ji(this),this.g)))if(this.responseType==="arraybuffer")c.arrayBuffer().then(this.Na.bind(this),this.ga.bind(this));else if(typeof o.ReadableStream<"u"&&"body"in c){if(this.j=c.body.getReader(),this.o){if(this.responseType)throw Error('responseType must be empty for "streamBinaryChunks" mode responses.');this.response=[]}else this.response=this.responseText="",this.B=new TextDecoder;zd(this)}else c.text().then(this.Oa.bind(this),this.ga.bind(this))};function zd(c){c.j.read().then(c.Ma.bind(c)).catch(c.ga.bind(c))}n.Ma=function(c){if(this.g){if(this.o&&c.value)this.response.push(c.value);else if(!this.o){var d=c.value?c.value:new Uint8Array(0);(d=this.B.decode(d,{stream:!c.done}))&&(this.response=this.responseText+=d)}c.done?Qi(this):Ji(this),this.readyState==3&&zd(this)}},n.Oa=function(c){this.g&&(this.response=this.responseText=c,Qi(this))},n.Na=function(c){this.g&&(this.response=c,Qi(this))},n.ga=function(){this.g&&Qi(this)};function Qi(c){c.readyState=4,c.l=null,c.j=null,c.B=null,Ji(c)}n.setRequestHeader=function(c,d){this.A.append(c,d)},n.getResponseHeader=function(c){return this.h&&this.h.get(c.toLowerCase())||""},n.getAllResponseHeaders=function(){if(!this.h)return"";const c=[],d=this.h.entries();for(var m=d.next();!m.done;)m=m.value,c.push(m[0]+": "+m[1]),m=d.next();return c.join(`\r
`)};function Ji(c){c.onreadystatechange&&c.onreadystatechange.call(c)}Object.defineProperty(Ta.prototype,"withCredentials",{get:function(){return this.m==="include"},set:function(c){this.m=c?"include":"same-origin"}});function Kd(c){let d="";return Nn(c,function(m,g){d+=g,d+=":",d+=m,d+=`\r
`}),d}function Ru(c,d,m){e:{for(g in m){var g=!1;break e}g=!0}g||(m=Kd(m),typeof c=="string"?m!=null&&qi(m):ke(c,d,m))}function Me(c){Se.call(this),this.headers=new Map,this.L=c||null,this.h=!1,this.g=null,this.D="",this.o=0,this.l="",this.j=this.B=this.v=this.A=!1,this.m=null,this.F="",this.H=!1}f(Me,Se);var Fw=/^https?$/i,Uw=["POST","PUT"];n=Me.prototype,n.Fa=function(c){this.H=c},n.ea=function(c,d,m,g){if(this.g)throw Error("[goog.net.XhrIo] Object is active with another request="+this.D+"; newUri="+c);d=d?d.toUpperCase():"GET",this.D=c,this.l="",this.o=0,this.A=!1,this.h=!0,this.g=this.L?this.L.g():Rd.g(),this.g.onreadystatechange=p(l(this.Ca,this));try{this.B=!0,this.g.open(d,String(c),!0),this.B=!1}catch(N){Wd(this,N);return}if(c=m||"",m=new Map(this.headers),g)if(Object.getPrototypeOf(g)===Object.prototype)for(var R in g)m.set(R,g[R]);else if(typeof g.keys=="function"&&typeof g.get=="function")for(const N of g.keys())m.set(N,g.get(N));else throw Error("Unknown input type for opt_headers: "+String(g));g=Array.from(m.keys()).find(N=>N.toLowerCase()=="content-type"),R=o.FormData&&c instanceof o.FormData,!(Array.prototype.indexOf.call(Uw,d,void 0)>=0)||g||R||m.set("Content-Type","application/x-www-form-urlencoded;charset=utf-8");for(const[N,U]of m)this.g.setRequestHeader(N,U);this.F&&(this.g.responseType=this.F),"withCredentials"in this.g&&this.g.withCredentials!==this.H&&(this.g.withCredentials=this.H);try{this.m&&(clearTimeout(this.m),this.m=null),this.v=!0,this.g.send(c),this.v=!1}catch(N){Wd(this,N)}};function Wd(c,d){c.h=!1,c.g&&(c.j=!0,c.g.abort(),c.j=!1),c.l=d,c.o=5,Hd(c),Aa(c)}function Hd(c){c.A||(c.A=!0,he(c,"complete"),he(c,"error"))}n.abort=function(c){this.g&&this.h&&(this.h=!1,this.j=!0,this.g.abort(),this.j=!1,this.o=c||7,he(this,"complete"),he(this,"abort"),Aa(this))},n.N=function(){this.g&&(this.h&&(this.h=!1,this.j=!0,this.g.abort(),this.j=!1),Aa(this,!0)),Me.Z.N.call(this)},n.Ca=function(){this.u||(this.B||this.v||this.j?Qd(this):this.Xa())},n.Xa=function(){Qd(this)};function Qd(c){if(c.h&&typeof i<"u"){if(c.v&&Bn(c)==4)setTimeout(c.Ca.bind(c),0);else if(he(c,"readystatechange"),Bn(c)==4){c.h=!1;try{const N=c.ca();e:switch(N){case 200:case 201:case 202:case 204:case 206:case 304:case 1223:var d=!0;break e;default:d=!1}var m;if(!(m=d)){var g;if(g=N===0){let U=String(c.D).match(Bd)[1]||null;!U&&o.self&&o.self.location&&(U=o.self.location.protocol.slice(0,-1)),g=!Fw.test(U?U.toLowerCase():"")}m=g}if(m)he(c,"complete"),he(c,"success");else{c.o=6;try{var R=Bn(c)>2?c.g.statusText:""}catch{R=""}c.l=R+" ["+c.ca()+"]",Hd(c)}}finally{Aa(c)}}}}function Aa(c,d){if(c.g){c.m&&(clearTimeout(c.m),c.m=null);const m=c.g;c.g=null,d||he(c,"ready");try{m.onreadystatechange=null}catch{}}}n.isActive=function(){return!!this.g};function Bn(c){return c.g?c.g.readyState:0}n.ca=function(){try{return Bn(this)>2?this.g.status:-1}catch{return-1}},n.la=function(){try{return this.g?this.g.responseText:""}catch{return""}},n.La=function(c){if(this.g){var d=this.g.responseText;return c&&d.indexOf(c)==0&&(d=d.substring(c.length)),_u(d)}};function Jd(c){try{if(!c.g)return null;if("response"in c.g)return c.g.response;switch(c.F){case"":case"text":return c.g.responseText;case"arraybuffer":if("mozResponseArrayBuffer"in c.g)return c.g.mozResponseArrayBuffer}return null}catch{return null}}function $w(c){const d={};c=(c.g&&Bn(c)>=2&&c.g.getAllResponseHeaders()||"").split(`\r
`);for(let g=0;g<c.length;g++){if(I(c[g]))continue;var m=bw(c[g]);const R=m[0];if(m=m[1],typeof m!="string")continue;m=m.trim();const N=d[R]||[];d[R]=N,N.push(m)}gs(d,function(g){return g.join(", ")})}n.ya=function(){return this.o},n.Ha=function(){return typeof this.l=="string"?this.l:String(this.l)};function Yi(c,d,m){return m&&m.internalChannelParams&&m.internalChannelParams[c]||d}function Yd(c){this.za=0,this.i=[],this.j=new $i,this.ba=this.na=this.J=this.W=this.g=this.wa=this.G=this.H=this.u=this.U=this.o=null,this.Ya=this.V=0,this.Sa=Yi("failFast",!1,c),this.F=this.C=this.v=this.m=this.l=null,this.X=!0,this.xa=this.K=-1,this.Y=this.A=this.D=0,this.Qa=Yi("baseRetryDelayMs",5e3,c),this.Za=Yi("retryDelaySeedMs",1e4,c),this.Ta=Yi("forwardChannelMaxRetries",2,c),this.va=Yi("forwardChannelRequestTimeoutMs",2e4,c),this.ma=c&&c.xmlHttpFactory||void 0,this.Ua=c&&c.Rb||void 0,this.Aa=c&&c.useFetchStreams||!1,this.O=void 0,this.L=c&&c.supportsCrossDomainXhr||!1,this.M="",this.h=new Vd(c&&c.concurrentRequestLimit),this.Ba=new Bw,this.S=c&&c.fastHandshake||!1,this.R=c&&c.encodeInitMessageHeaders||!1,this.S&&this.R&&(this.R=!1),this.Ra=c&&c.Pb||!1,c&&c.ua&&this.j.ua(),c&&c.forceLongPolling&&(this.X=!1),this.aa=!this.S&&this.X&&c&&c.detectBufferingProxy||!1,this.ia=void 0,c&&c.longPollingTimeout&&c.longPollingTimeout>0&&(this.ia=c.longPollingTimeout),this.ta=void 0,this.T=0,this.P=!1,this.ja=this.B=null}n=Yd.prototype,n.ka=8,n.I=1,n.connect=function(c,d,m,g){mt(0),this.W=c,this.H=d||{},m&&g!==void 0&&(this.H.OSID=m,this.H.OAID=g),this.F=this.X,this.J=af(this,null,this.W),ba(this)};function Pu(c){if(Xd(c),c.I==3){var d=c.V++,m=Gt(c.J);if(ke(m,"SID",c.M),ke(m,"RID",d),ke(m,"TYPE","terminate"),Xi(c,m),d=new xn(c,c.j,d),d.M=2,d.A=Ea(Gt(m)),m=!1,o.navigator&&o.navigator.sendBeacon)try{m=o.navigator.sendBeacon(d.A.toString(),"")}catch{}!m&&o.Image&&(new Image().src=d.A,m=!0),m||(d.g=cf(d.j,null),d.g.ea(d.A)),d.F=Date.now(),wa(d)}of(c)}function va(c){c.g&&(Cu(c),c.g.cancel(),c.g=null)}function Xd(c){va(c),c.v&&(o.clearTimeout(c.v),c.v=null),Sa(c),c.h.cancel(),c.m&&(typeof c.m=="number"&&o.clearTimeout(c.m),c.m=null)}function ba(c){if(!Od(c.h)&&!c.m){c.m=!0;var d=c.Ea;ne||y(),H||(ne(),H=!0),T.add(d,c),c.D=0}}function qw(c,d){return xd(c.h)>=c.h.j-(c.m?1:0)?!1:c.m?(c.i=d.G.concat(c.i),!0):c.I==1||c.I==2||c.D>=(c.Sa?0:c.Ta)?!1:(c.m=Ui(l(c.Ea,c,d),sf(c,c.D)),c.D++,!0)}n.Ea=function(c){if(this.m)if(this.m=null,this.I==1){if(!c){this.V=Math.floor(Math.random()*1e5),c=this.V++;const R=new xn(this,this.j,c);let N=this.o;if(this.U&&(N?(N=Di(N),_a(N,this.U)):N=this.U),this.u!==null||this.R||(R.J=N,N=null),this.S)e:{for(var d=0,m=0;m<this.i.length;m++){t:{var g=this.i[m];if("__data__"in g.map&&(g=g.map.__data__,typeof g=="string")){g=g.length;break t}g=void 0}if(g===void 0)break;if(d+=g,d>4096){d=m;break e}if(d===4096||m===this.i.length-1){d=m+1;break e}}d=1e3}else d=1e3;d=ef(this,R,d),m=Gt(this.J),ke(m,"RID",c),ke(m,"CVER",22),this.G&&ke(m,"X-HTTP-Session-Id",this.G),Xi(this,m),N&&(this.R?d="headers="+qi(Kd(N))+"&"+d:this.u&&Ru(m,this.u,N)),vu(this.h,R),this.Ra&&ke(m,"TYPE","init"),this.S?(ke(m,"$req",d),ke(m,"SID","null"),R.U=!0,wu(R,m,null)):wu(R,m,d),this.I=2}}else this.I==3&&(c?Zd(this,c):this.i.length==0||Od(this.h)||Zd(this))};function Zd(c,d){var m;d?m=d.l:m=c.V++;const g=Gt(c.J);ke(g,"SID",c.M),ke(g,"RID",m),ke(g,"AID",c.K),Xi(c,g),c.u&&c.o&&Ru(g,c.u,c.o),m=new xn(c,c.j,m,c.D+1),c.u===null&&(m.J=c.o),d&&(c.i=d.G.concat(c.i)),d=ef(c,m,1e3),m.H=Math.round(c.va*.5)+Math.round(c.va*.5*Math.random()),vu(c.h,m),wu(m,g,d)}function Xi(c,d){c.H&&Nn(c.H,function(m,g){ke(d,g,m)}),c.l&&Nn({},function(m,g){ke(d,g,m)})}function ef(c,d,m){m=Math.min(c.i.length,m);const g=c.l?l(c.l.Ka,c.l,c):null;e:{var R=c.i;let ie=-1;for(;;){const Qe=["count="+m];ie==-1?m>0?(ie=R[0].g,Qe.push("ofs="+ie)):ie=0:Qe.push("ofs="+ie);let Te=!0;for(let et=0;et<m;et++){var N=R[et].g;const zt=R[et].map;if(N-=ie,N<0)ie=Math.max(0,R[et].g-100),Te=!1;else try{N="req"+N+"_"||"";try{var U=zt instanceof Map?zt:Object.entries(zt);for(const[Vr,Fn]of U){let Un=Fn;a(Fn)&&(Un=Is(Fn)),Qe.push(N+Vr+"="+encodeURIComponent(Un))}}catch(Vr){throw Qe.push(N+"type="+encodeURIComponent("_badmap")),Vr}}catch{g&&g(zt)}}if(Te){U=Qe.join("&");break e}}U=void 0}return c=c.i.splice(0,m),d.G=c,U}function tf(c){if(!c.g&&!c.v){c.Y=1;var d=c.Da;ne||y(),H||(ne(),H=!0),T.add(d,c),c.A=0}}function ku(c){return c.g||c.v||c.A>=3?!1:(c.Y++,c.v=Ui(l(c.Da,c),sf(c,c.A)),c.A++,!0)}n.Da=function(){if(this.v=null,nf(this),this.aa&&!(this.P||this.g==null||this.T<=0)){var c=4*this.T;this.j.info("BP detection timer enabled: "+c),this.B=Ui(l(this.Wa,this),c)}},n.Wa=function(){this.B&&(this.B=null,this.j.info("BP detection timeout reached."),this.j.info("Buffering proxy detected and switch to long-polling!"),this.F=!1,this.P=!0,mt(10),va(this),nf(this))};function Cu(c){c.B!=null&&(o.clearTimeout(c.B),c.B=null)}function nf(c){c.g=new xn(c,c.j,"rpc",c.Y),c.u===null&&(c.g.J=c.o),c.g.P=0;var d=Gt(c.na);ke(d,"RID","rpc"),ke(d,"SID",c.M),ke(d,"AID",c.K),ke(d,"CI",c.F?"0":"1"),!c.F&&c.ia&&ke(d,"TO",c.ia),ke(d,"TYPE","xmlhttp"),Xi(c,d),c.u&&c.o&&Ru(d,c.u,c.o),c.O&&(c.g.H=c.O);var m=c.g;c=c.ba,m.M=1,m.A=Ea(Gt(d)),m.u=null,m.R=!0,Cd(m,c)}n.Va=function(){this.C!=null&&(this.C=null,va(this),ku(this),mt(19))};function Sa(c){c.C!=null&&(o.clearTimeout(c.C),c.C=null)}function rf(c,d){var m=null;if(c.g==d){Sa(c),Cu(c),c.g=null;var g=2}else if(Au(c.h,d))m=d.G,Md(c.h,d),g=1;else return;if(c.I!=0){if(d.o)if(g==1){m=d.u?d.u.length:0,d=Date.now()-d.F;var R=c.D;g=kr(),he(g,new bd(g,m)),ba(c)}else tf(c);else if(R=d.m,R==3||R==0&&d.X>0||!(g==1&&qw(c,d)||g==2&&ku(c)))switch(m&&m.length>0&&(d=c.h,d.i=d.i.concat(m)),R){case 1:Dr(c,5);break;case 4:Dr(c,10);break;case 3:Dr(c,6);break;default:Dr(c,2)}}}function sf(c,d){let m=c.Qa+Math.floor(Math.random()*c.Za);return c.isActive()||(m*=2),m*d}function Dr(c,d){if(c.j.info("Error code "+d),d==2){var m=l(c.bb,c),g=c.Ua;const R=!g;g=new Mn(g||"//www.google.com/images/cleardot.gif"),o.location&&o.location.protocol=="http"||Gi(g,"https"),Ea(g),R?Mw(g.toString(),m):Lw(g.toString(),m)}else mt(2);c.I=0,c.l&&c.l.pa(d),of(c),Xd(c)}n.bb=function(c){c?(this.j.info("Successfully pinged google.com"),mt(2)):(this.j.info("Failed to ping google.com"),mt(1))};function of(c){if(c.I=0,c.ja=[],c.l){const d=Ld(c.h);(d.length!=0||c.i.length!=0)&&(w(c.ja,d),w(c.ja,c.i),c.h.i.length=0,_(c.i),c.i.length=0),c.l.oa()}}function af(c,d,m){var g=m instanceof Mn?Gt(m):new Mn(m);if(g.g!="")d&&(g.g=d+"."+g.g),zi(g,g.u);else{var R=o.location;g=R.protocol,d=d?d+"."+R.hostname:R.hostname,R=+R.port;const N=new Mn(null);g&&Gi(N,g),d&&(N.g=d),R&&zi(N,R),m&&(N.h=m),g=N}return m=c.G,d=c.wa,m&&d&&ke(g,m,d),ke(g,"VER",c.ka),Xi(c,g),g}function cf(c,d,m){if(d&&!c.L)throw Error("Can't create secondary domain capable XhrIo object.");return d=c.Aa&&!c.ma?new Me(new Su({ab:m})):new Me(c.ma),d.Fa(c.L),d}n.isActive=function(){return!!this.l&&this.l.isActive(this)};function uf(){}n=uf.prototype,n.ra=function(){},n.qa=function(){},n.pa=function(){},n.oa=function(){},n.isActive=function(){return!0},n.Ka=function(){};function Ra(){}Ra.prototype.g=function(c,d){return new Et(c,d)};function Et(c,d){Se.call(this),this.g=new Yd(d),this.l=c,this.h=d&&d.messageUrlParams||null,c=d&&d.messageHeaders||null,d&&d.clientProtocolHeaderRequired&&(c?c["X-Client-Protocol"]="webchannel":c={"X-Client-Protocol":"webchannel"}),this.g.o=c,c=d&&d.initMessageHeaders||null,d&&d.messageContentType&&(c?c["X-WebChannel-Content-Type"]=d.messageContentType:c={"X-WebChannel-Content-Type":d.messageContentType}),d&&d.sa&&(c?c["X-WebChannel-Client-Profile"]=d.sa:c={"X-WebChannel-Client-Profile":d.sa}),this.g.U=c,(c=d&&d.Qb)&&!I(c)&&(this.g.u=c),this.A=d&&d.supportsCrossDomainXhr||!1,this.v=d&&d.sendRawJson||!1,(d=d&&d.httpSessionIdParam)&&!I(d)&&(this.g.G=d,c=this.h,c!==null&&d in c&&(c=this.h,d in c&&delete c[d])),this.j=new As(this)}f(Et,Se),Et.prototype.m=function(){this.g.l=this.j,this.A&&(this.g.L=!0),this.g.connect(this.l,this.h||void 0)},Et.prototype.close=function(){Pu(this.g)},Et.prototype.o=function(c){var d=this.g;if(typeof c=="string"){var m={};m.__data__=c,c=m}else this.v&&(m={},m.__data__=Is(c),c=m);d.i.push(new Pw(d.Ya++,c)),d.I==3&&ba(d)},Et.prototype.N=function(){this.g.l=null,delete this.j,Pu(this.g),delete this.g,Et.Z.N.call(this)};function lf(c){Vn.call(this),c.__headers__&&(this.headers=c.__headers__,this.statusCode=c.__status__,delete c.__headers__,delete c.__status__);var d=c.__sm__;if(d){e:{for(const m in d){c=m;break e}c=void 0}(this.i=c)&&(c=this.i,d=d!==null&&c in d?d[c]:void 0),this.data=d}else this.data=c}f(lf,Vn);function hf(){Pr.call(this),this.status=1}f(hf,Pr);function As(c){this.g=c}f(As,uf),As.prototype.ra=function(){he(this.g,"a")},As.prototype.qa=function(c){he(this.g,new lf(c))},As.prototype.pa=function(c){he(this.g,new hf)},As.prototype.oa=function(){he(this.g,"b")},Ra.prototype.createWebChannel=Ra.prototype.g,Et.prototype.send=Et.prototype.o,Et.prototype.open=Et.prototype.m,Et.prototype.close=Et.prototype.close,Ng=function(){return new Ra},Cg=function(){return kr()},kg=dn,al={jb:0,mb:1,nb:2,Hb:3,Mb:4,Jb:5,Kb:6,Ib:7,Gb:8,Lb:9,PROXY:10,NOPROXY:11,Eb:12,Ab:13,Bb:14,zb:15,Cb:16,Db:17,fb:18,eb:19,gb:20},Ia.NO_ERROR=0,Ia.TIMEOUT=8,Ia.HTTP_ERROR=6,za=Ia,Sd.COMPLETE="complete",Pg=Sd,Bi.EventType=jt,jt.OPEN="a",jt.CLOSE="b",jt.ERROR="c",jt.MESSAGE="d",Se.prototype.listen=Se.prototype.J,lo=Bi,Me.prototype.listenOnce=Me.prototype.K,Me.prototype.getLastError=Me.prototype.Ha,Me.prototype.getLastErrorCode=Me.prototype.ya,Me.prototype.getStatus=Me.prototype.ca,Me.prototype.getResponseJson=Me.prototype.La,Me.prototype.getResponseText=Me.prototype.la,Me.prototype.send=Me.prototype.ea,Me.prototype.setWithCredentials=Me.prototype.Fa,Rg=Me}).apply(typeof Ca<"u"?Ca:typeof self<"u"?self:typeof window<"u"?window:{});/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class nt{constructor(e){this.uid=e}isAuthenticated(){return this.uid!=null}toKey(){return this.isAuthenticated()?"uid:"+this.uid:"anonymous-user"}isEqual(e){return e.uid===this.uid}}nt.UNAUTHENTICATED=new nt(null),nt.GOOGLE_CREDENTIALS=new nt("google-credentials-uid"),nt.FIRST_PARTY=new nt("first-party-uid"),nt.MOCK_USER=new nt("mock-user");/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */let pi="12.14.0";function Vv(n){pi=n}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const cr=new jl("@firebase/firestore");function Cs(){return cr.logLevel}function x0(n){cr.setLogLevel(n)}function x(n,...e){if(cr.logLevel<=ce.DEBUG){const t=e.map(Zl);cr.debug(`Firestore (${pi}): ${n}`,...t)}}function qe(n,...e){if(cr.logLevel<=ce.ERROR){const t=e.map(Zl);cr.error(`Firestore (${pi}): ${n}`,...t)}}function Rt(n,...e){if(cr.logLevel<=ce.WARN){const t=e.map(Zl);cr.warn(`Firestore (${pi}): ${n}`,...t)}}function Zl(n){if(typeof n=="string")return n;try{return(function(t){return JSON.stringify(t)})(n)}catch{return n}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function j(n,e,t){let r="Unexpected state";typeof e=="string"?r=e:t=e,Dg(n,r,t)}function Dg(n,e,t){let r=`FIRESTORE (${pi}) INTERNAL ASSERTION FAILED: ${e} (ID: ${n.toString(16)})`;if(t!==void 0)try{r+=" CONTEXT: "+JSON.stringify(t)}catch{r+=" CONTEXT: "+t}throw qe(r),new Error(r)}function K(n,e,t,r){let s="Unexpected state";typeof t=="string"?s=t:r=t,n||Dg(e,s,r)}function M0(n,e){n||j(57014,e)}function F(n,e){return n}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const k={OK:"ok",CANCELLED:"cancelled",UNKNOWN:"unknown",INVALID_ARGUMENT:"invalid-argument",DEADLINE_EXCEEDED:"deadline-exceeded",NOT_FOUND:"not-found",ALREADY_EXISTS:"already-exists",PERMISSION_DENIED:"permission-denied",UNAUTHENTICATED:"unauthenticated",RESOURCE_EXHAUSTED:"resource-exhausted",FAILED_PRECONDITION:"failed-precondition",ABORTED:"aborted",OUT_OF_RANGE:"out-of-range",UNIMPLEMENTED:"unimplemented",INTERNAL:"internal",UNAVAILABLE:"unavailable",DATA_LOSS:"data-loss"};class D extends un{constructor(e,t){super(e,t),this.code=e,this.message=t,this.toString=()=>`${this.name}: [code=${this.code}]: ${this.message}`}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class st{constructor(){this.promise=new Promise(((e,t)=>{this.resolve=e,this.reject=t}))}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Vg{constructor(e,t){this.user=t,this.type="OAuth",this.headers=new Map,this.headers.set("Authorization",`Bearer ${e}`)}}class Ov{getToken(){return Promise.resolve(null)}invalidateToken(){}start(e,t){e.enqueueRetryable((()=>t(nt.UNAUTHENTICATED)))}shutdown(){}}class xv{constructor(e){this.token=e,this.changeListener=null}getToken(){return Promise.resolve(this.token)}invalidateToken(){}start(e,t){this.changeListener=t,e.enqueueRetryable((()=>t(this.token.user)))}shutdown(){this.changeListener=null}}class Mv{constructor(e){this.t=e,this.currentUser=nt.UNAUTHENTICATED,this.i=0,this.forceRefresh=!1,this.auth=null}start(e,t){K(this.o===void 0,42304);let r=this.i;const s=u=>this.i!==r?(r=this.i,t(u)):Promise.resolve();let i=new st;this.o=()=>{this.i++,this.currentUser=this.u(),i.resolve(),i=new st,e.enqueueRetryable((()=>s(this.currentUser)))};const o=()=>{const u=i;e.enqueueRetryable((async()=>{await u.promise,await s(this.currentUser)}))},a=u=>{x("FirebaseAuthCredentialsProvider","Auth detected"),this.auth=u,this.o&&(this.auth.addAuthTokenListener(this.o),o())};this.t.onInit((u=>a(u))),setTimeout((()=>{if(!this.auth){const u=this.t.getImmediate({optional:!0});u?a(u):(x("FirebaseAuthCredentialsProvider","Auth not yet detected"),i.resolve(),i=new st)}}),0),o()}getToken(){const e=this.i,t=this.forceRefresh;return this.forceRefresh=!1,this.auth?this.auth.getToken(t).then((r=>this.i!==e?(x("FirebaseAuthCredentialsProvider","getToken aborted due to token change."),this.getToken()):r?(K(typeof r.accessToken=="string",31837,{l:r}),new Vg(r.accessToken,this.currentUser)):null)):Promise.resolve(null)}invalidateToken(){this.forceRefresh=!0}shutdown(){this.auth&&this.o&&this.auth.removeAuthTokenListener(this.o),this.o=void 0}u(){const e=this.auth&&this.auth.getUid();return K(e===null||typeof e=="string",2055,{h:e}),new nt(e)}}class Lv{constructor(e,t,r){this.P=e,this.T=t,this.I=r,this.type="FirstParty",this.user=nt.FIRST_PARTY,this.R=new Map}A(){return this.I?this.I():null}get headers(){this.R.set("X-Goog-AuthUser",this.P);const e=this.A();return e&&this.R.set("Authorization",e),this.T&&this.R.set("X-Goog-Iam-Authorization-Token",this.T),this.R}}class Bv{constructor(e,t,r){this.P=e,this.T=t,this.I=r}getToken(){return Promise.resolve(new Lv(this.P,this.T,this.I))}start(e,t){e.enqueueRetryable((()=>t(nt.FIRST_PARTY)))}shutdown(){}invalidateToken(){}}class cl{constructor(e){this.value=e,this.type="AppCheck",this.headers=new Map,e&&e.length>0&&this.headers.set("x-firebase-appcheck",this.value)}}class Fv{constructor(e,t){this.V=t,this.forceRefresh=!1,this.appCheck=null,this.m=null,this.p=null,Ct(e)&&e.settings.appCheckToken&&(this.p=e.settings.appCheckToken)}start(e,t){K(this.o===void 0,3512);const r=i=>{i.error!=null&&x("FirebaseAppCheckTokenProvider",`Error getting App Check token; using placeholder token instead. Error: ${i.error.message}`);const o=i.token!==this.m;return this.m=i.token,x("FirebaseAppCheckTokenProvider",`Received ${o?"new":"existing"} token.`),o?t(i.token):Promise.resolve()};this.o=i=>{e.enqueueRetryable((()=>r(i)))};const s=i=>{x("FirebaseAppCheckTokenProvider","AppCheck detected"),this.appCheck=i,this.o&&this.appCheck.addTokenListener(this.o)};this.V.onInit((i=>s(i))),setTimeout((()=>{if(!this.appCheck){const i=this.V.getImmediate({optional:!0});i?s(i):x("FirebaseAppCheckTokenProvider","AppCheck not yet detected")}}),0)}getToken(){if(this.p)return Promise.resolve(new cl(this.p));const e=this.forceRefresh;return this.forceRefresh=!1,this.appCheck?this.appCheck.getToken(e).then((t=>t?(K(typeof t.token=="string",44558,{tokenResult:t}),this.m=t.token,new cl(t.token)):null)):Promise.resolve(null)}invalidateToken(){this.forceRefresh=!0}shutdown(){this.appCheck&&this.o&&this.appCheck.removeTokenListener(this.o),this.o=void 0}}class L0{getToken(){return Promise.resolve(new cl(""))}invalidateToken(){}start(e,t){}shutdown(){}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Uv(n){const e=typeof self<"u"&&(self.crypto||self.msCrypto),t=new Uint8Array(n);if(e&&typeof e.getRandomValues=="function")e.getRandomValues(t);else for(let r=0;r<n;r++)t[r]=Math.floor(256*Math.random());return t}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class eh{static newId(){const e="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",t=62*Math.floor(4.129032258064516);let r="";for(;r.length<20;){const s=Uv(40);for(let i=0;i<s.length;++i)r.length<20&&s[i]<t&&(r+=e.charAt(s[i]%62))}return r}}function Z(n,e){return n<e?-1:n>e?1:0}function ul(n,e){const t=Math.min(n.length,e.length);for(let r=0;r<t;r++){const s=n.charAt(r),i=e.charAt(r);if(s!==i)return Fu(s)===Fu(i)?Z(s,i):Fu(s)?1:-1}return Z(n.length,e.length)}const $v=55296,qv=57343;function Fu(n){const e=n.charCodeAt(0);return e>=$v&&e<=qv}function zs(n,e,t){return n.length===e.length&&n.every(((r,s)=>t(r,e[s])))}function Og(n){return n+"\0"}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const ll="__name__";class Kt{constructor(e,t,r){t===void 0?t=0:t>e.length&&j(637,{offset:t,range:e.length}),r===void 0?r=e.length-t:r>e.length-t&&j(1746,{length:r,range:e.length-t}),this.segments=e,this.offset=t,this.len=r}get length(){return this.len}isEqual(e){return Kt.comparator(this,e)===0}child(e){const t=this.segments.slice(this.offset,this.limit());return e instanceof Kt?e.forEach((r=>{t.push(r)})):t.push(e),this.construct(t)}limit(){return this.offset+this.length}popFirst(e){return e=e===void 0?1:e,this.construct(this.segments,this.offset+e,this.length-e)}popLast(){return this.construct(this.segments,this.offset,this.length-1)}firstSegment(){return this.segments[this.offset]}lastSegment(){return this.get(this.length-1)}get(e){return this.segments[this.offset+e]}isEmpty(){return this.length===0}isPrefixOf(e){if(e.length<this.length)return!1;for(let t=0;t<this.length;t++)if(this.get(t)!==e.get(t))return!1;return!0}isImmediateParentOf(e){if(this.length+1!==e.length)return!1;for(let t=0;t<this.length;t++)if(this.get(t)!==e.get(t))return!1;return!0}forEach(e){for(let t=this.offset,r=this.limit();t<r;t++)e(this.segments[t])}toArray(){return this.segments.slice(this.offset,this.limit())}static comparator(e,t){const r=Math.min(e.length,t.length);for(let s=0;s<r;s++){const i=Kt.compareSegments(e.get(s),t.get(s));if(i!==0)return i}return Z(e.length,t.length)}static compareSegments(e,t){const r=Kt.isNumericId(e),s=Kt.isNumericId(t);return r&&!s?-1:!r&&s?1:r&&s?Kt.extractNumericId(e).compare(Kt.extractNumericId(t)):ul(e,t)}static isNumericId(e){return e.startsWith("__id")&&e.endsWith("__")}static extractNumericId(e){return ir.fromString(e.substring(4,e.length-2))}}class oe extends Kt{construct(e,t,r){return new oe(e,t,r)}canonicalString(){return this.toArray().join("/")}toString(){return this.canonicalString()}toUriEncodedString(){return this.toArray().map(encodeURIComponent).join("/")}static fromString(...e){const t=[];for(const r of e){if(r.indexOf("//")>=0)throw new D(k.INVALID_ARGUMENT,`Invalid segment (${r}). Paths must not contain // in them.`);t.push(...r.split("/").filter((s=>s.length>0)))}return new oe(t)}static emptyPath(){return new oe([])}}const jv=/^[_a-zA-Z][_a-zA-Z0-9]*$/;class Ve extends Kt{construct(e,t,r){return new Ve(e,t,r)}static isValidIdentifier(e){return jv.test(e)}canonicalString(){return this.toArray().map((e=>(e=e.replace(/\\/g,"\\\\").replace(/`/g,"\\`"),Ve.isValidIdentifier(e)||(e="`"+e+"`"),e))).join(".")}toString(){return this.canonicalString()}isKeyField(){return this.length===1&&this.get(0)===ll}static keyField(){return new Ve([ll])}static fromServerFormat(e){const t=[];let r="",s=0;const i=()=>{if(r.length===0)throw new D(k.INVALID_ARGUMENT,`Invalid field path (${e}). Paths must not be empty, begin with '.', end with '.', or contain '..'`);t.push(r),r=""};let o=!1;for(;s<e.length;){const a=e[s];if(a==="\\"){if(s+1===e.length)throw new D(k.INVALID_ARGUMENT,"Path has trailing escape character: "+e);const u=e[s+1];if(u!=="\\"&&u!=="."&&u!=="`")throw new D(k.INVALID_ARGUMENT,"Path has invalid escape sequence: "+e);r+=u,s+=2}else a==="`"?(o=!o,s++):a!=="."||o?(r+=a,s++):(i(),s++)}if(i(),o)throw new D(k.INVALID_ARGUMENT,"Unterminated ` in path: "+e);return new Ve(t)}static emptyPath(){return new Ve([])}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class B{constructor(e){this.path=e}static fromPath(e){return new B(oe.fromString(e))}static fromName(e){return new B(oe.fromString(e).popFirst(5))}static empty(){return new B(oe.emptyPath())}get collectionGroup(){return this.path.popLast().lastSegment()}hasCollectionId(e){return this.path.length>=2&&this.path.get(this.path.length-2)===e}getCollectionGroup(){return this.path.get(this.path.length-2)}getCollectionPath(){return this.path.popLast()}isEqual(e){return e!==null&&oe.comparator(this.path,e.path)===0}toString(){return this.path.toString()}static comparator(e,t){return oe.comparator(e.path,t.path)}static isDocumentKey(e){return e.length%2==0}static fromSegments(e){return new B(new oe(e.slice()))}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function th(n,e,t){if(!t)throw new D(k.INVALID_ARGUMENT,`Function ${n}() cannot be called with an empty ${e}.`)}function Gv(n,e,t,r){if(e===!0&&r===!0)throw new D(k.INVALID_ARGUMENT,`${n} and ${t} cannot be used together.`)}function qf(n){if(!B.isDocumentKey(n))throw new D(k.INVALID_ARGUMENT,`Invalid document reference. Document references must have an even number of segments, but ${n} has ${n.length}.`)}function jf(n){if(B.isDocumentKey(n))throw new D(k.INVALID_ARGUMENT,`Invalid collection reference. Collection references must have an odd number of segments, but ${n} has ${n.length}.`)}function xg(n){return typeof n=="object"&&n!==null&&(Object.getPrototypeOf(n)===Object.prototype||Object.getPrototypeOf(n)===null)}function Bc(n){if(n===void 0)return"undefined";if(n===null)return"null";if(typeof n=="string")return n.length>20&&(n=`${n.substring(0,20)}...`),JSON.stringify(n);if(typeof n=="number"||typeof n=="boolean")return""+n;if(typeof n=="object"){if(n instanceof Array)return"an array";{const e=(function(r){return r.constructor?r.constructor.name:null})(n);return e?`a custom ${e} object`:"an object"}}return typeof n=="function"?"a function":j(12329,{type:typeof n})}function ae(n,e){if("_delegate"in n&&(n=n._delegate),!(n instanceof e)){if(e.name===n.constructor.name)throw new D(k.INVALID_ARGUMENT,"Type does not match the expected instance. Did you pass a reference from a different Firestore SDK?");{const t=Bc(n);throw new D(k.INVALID_ARGUMENT,`Expected type '${e.name}', but it was: ${t}`)}}return n}function Mg(n,e){if(e<=0)throw new D(k.INVALID_ARGUMENT,`Function ${n}() requires a positive number, but it was: ${e}.`)}/**
 * @license
 * Copyright 2025 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Ke(n,e){const t={typeString:n};return e&&(t.value=e),t}function us(n,e){if(!xg(n))throw new D(k.INVALID_ARGUMENT,"JSON must be an object");let t;for(const r in e)if(e[r]){const s=e[r].typeString,i="value"in e[r]?{value:e[r].value}:void 0;if(!(r in n)){t=`JSON missing required field: '${r}'`;break}const o=n[r];if(s&&typeof o!==s){t=`JSON field '${r}' must be a ${s}.`;break}if(i!==void 0&&o!==i.value){t=`Expected '${r}' field to equal '${i.value}'`;break}}if(t)throw new D(k.INVALID_ARGUMENT,t);return!0}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Gf=-62135596800,zf=1e6;class _e{static now(){return _e.fromMillis(Date.now())}static fromDate(e){return _e.fromMillis(e.getTime())}static fromMillis(e){const t=Math.floor(e/1e3),r=Math.floor((e-1e3*t)*zf);return new _e(t,r)}constructor(e,t){if(this.seconds=e,this.nanoseconds=t,t<0)throw new D(k.INVALID_ARGUMENT,"Timestamp nanoseconds out of range: "+t);if(t>=1e9)throw new D(k.INVALID_ARGUMENT,"Timestamp nanoseconds out of range: "+t);if(e<Gf)throw new D(k.INVALID_ARGUMENT,"Timestamp seconds out of range: "+e);if(e>=253402300800)throw new D(k.INVALID_ARGUMENT,"Timestamp seconds out of range: "+e)}toDate(){return new Date(this.toMillis())}toMillis(){return 1e3*this.seconds+this.nanoseconds/zf}_compareTo(e){return this.seconds===e.seconds?Z(this.nanoseconds,e.nanoseconds):Z(this.seconds,e.seconds)}isEqual(e){return e.seconds===this.seconds&&e.nanoseconds===this.nanoseconds}toString(){return"Timestamp(seconds="+this.seconds+", nanoseconds="+this.nanoseconds+")"}toJSON(){return{type:_e._jsonSchemaVersion,seconds:this.seconds,nanoseconds:this.nanoseconds}}static fromJSON(e){if(us(e,_e._jsonSchema))return new _e(e.seconds,e.nanoseconds)}valueOf(){const e=this.seconds-Gf;return String(e).padStart(12,"0")+"."+String(this.nanoseconds).padStart(9,"0")}}_e._jsonSchemaVersion="firestore/timestamp/1.0",_e._jsonSchema={type:Ke("string",_e._jsonSchemaVersion),seconds:Ke("number"),nanoseconds:Ke("number")};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class J{static fromTimestamp(e){return new J(e)}static min(){return new J(new _e(0,0))}static max(){return new J(new _e(253402300799,999999999))}constructor(e){this.timestamp=e}compareTo(e){return this.timestamp._compareTo(e.timestamp)}isEqual(e){return this.timestamp.isEqual(e.timestamp)}toMicroseconds(){return 1e6*this.timestamp.seconds+this.timestamp.nanoseconds/1e3}toString(){return"SnapshotVersion("+this.timestamp.toString()+")"}toTimestamp(){return this.timestamp}}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Ks=-1;class Ws{constructor(e,t,r,s){this.indexId=e,this.collectionGroup=t,this.fields=r,this.indexState=s}}function hl(n){return n.fields.find((e=>e.kind===2))}function Mr(n){return n.fields.filter((e=>e.kind!==2))}function zv(n,e){let t=Z(n.collectionGroup,e.collectionGroup);if(t!==0)return t;for(let r=0;r<Math.min(n.fields.length,e.fields.length);++r)if(t=Kv(n.fields[r],e.fields[r]),t!==0)return t;return Z(n.fields.length,e.fields.length)}Ws.UNKNOWN_ID=-1;class jr{constructor(e,t){this.fieldPath=e,this.kind=t}}function Kv(n,e){const t=Ve.comparator(n.fieldPath,e.fieldPath);return t!==0?t:Z(n.kind,e.kind)}class Hs{constructor(e,t){this.sequenceNumber=e,this.offset=t}static empty(){return new Hs(0,Pt.min())}}function Lg(n,e){const t=n.toTimestamp().seconds,r=n.toTimestamp().nanoseconds+1,s=J.fromTimestamp(r===1e9?new _e(t+1,0):new _e(t,r));return new Pt(s,B.empty(),e)}function Bg(n){return new Pt(n.readTime,n.key,Ks)}class Pt{constructor(e,t,r){this.readTime=e,this.documentKey=t,this.largestBatchId=r}static min(){return new Pt(J.min(),B.empty(),Ks)}static max(){return new Pt(J.max(),B.empty(),Ks)}}function nh(n,e){let t=n.readTime.compareTo(e.readTime);return t!==0?t:(t=B.comparator(n.documentKey,e.documentKey),t!==0?t:Z(n.largestBatchId,e.largestBatchId))}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Fg="The current tab is not in the required state to perform this operation. It might be necessary to refresh the browser tab.";class Ug{constructor(){this.onCommittedListeners=[]}addOnCommittedListener(e){this.onCommittedListeners.push(e)}raiseOnCommittedEvent(){this.onCommittedListeners.forEach((e=>e()))}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function yr(n){if(n.code!==k.FAILED_PRECONDITION||n.message!==Fg)throw n;x("LocalStore","Unexpectedly lost primary lease")}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class S{constructor(e){this.nextCallback=null,this.catchCallback=null,this.result=void 0,this.error=void 0,this.isDone=!1,this.callbackAttached=!1,e((t=>{this.isDone=!0,this.result=t,this.nextCallback&&this.nextCallback(t)}),(t=>{this.isDone=!0,this.error=t,this.catchCallback&&this.catchCallback(t)}))}catch(e){return this.next(void 0,e)}next(e,t){return this.callbackAttached&&j(59440),this.callbackAttached=!0,this.isDone?this.error?this.wrapFailure(t,this.error):this.wrapSuccess(e,this.result):new S(((r,s)=>{this.nextCallback=i=>{this.wrapSuccess(e,i).next(r,s)},this.catchCallback=i=>{this.wrapFailure(t,i).next(r,s)}}))}toPromise(){return new Promise(((e,t)=>{this.next(e,t)}))}wrapUserFunction(e){try{const t=e();return t instanceof S?t:S.resolve(t)}catch(t){return S.reject(t)}}wrapSuccess(e,t){return e?this.wrapUserFunction((()=>e(t))):S.resolve(t)}wrapFailure(e,t){return e?this.wrapUserFunction((()=>e(t))):S.reject(t)}static resolve(e){return new S(((t,r)=>{t(e)}))}static reject(e){return new S(((t,r)=>{r(e)}))}static waitFor(e){return new S(((t,r)=>{let s=0,i=0,o=!1;e.forEach((a=>{++s,a.next((()=>{++i,o&&i===s&&t()}),(u=>r(u)))})),o=!0,i===s&&t()}))}static or(e){let t=S.resolve(!1);for(const r of e)t=t.next((s=>s?S.resolve(s):r()));return t}static forEach(e,t){const r=[];return e.forEach(((s,i)=>{r.push(t.call(this,s,i))})),this.waitFor(r)}static mapArray(e,t){return new S(((r,s)=>{const i=e.length,o=new Array(i);let a=0;for(let u=0;u<i;u++){const l=u;t(e[l]).next((h=>{o[l]=h,++a,a===i&&r(o)}),(h=>s(h)))}}))}static doWhile(e,t){return new S(((r,s)=>{const i=()=>{e()===!0?t().next((()=>{i()}),s):r()};i()}))}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Tt="SimpleDb";class Fc{static open(e,t,r,s){try{return new Fc(t,e.transaction(s,r))}catch(i){throw new go(t,i)}}constructor(e,t){this.action=e,this.transaction=t,this.aborted=!1,this.S=new st,this.transaction.oncomplete=()=>{this.S.resolve()},this.transaction.onabort=()=>{t.error?this.S.reject(new go(e,t.error)):this.S.resolve()},this.transaction.onerror=r=>{const s=rh(r.target.error);this.S.reject(new go(e,s))}}get D(){return this.S.promise}abort(e){e&&this.S.reject(e),this.aborted||(x(Tt,"Aborting transaction:",e?e.message:"Client-initiated abort"),this.aborted=!0,this.transaction.abort())}C(){const e=this.transaction;this.aborted||typeof e.commit!="function"||e.commit()}store(e){const t=this.transaction.objectStore(e);return new Hv(t)}}class tn{static delete(e){return x(Tt,"Removing database:",e),Br(Np().indexedDB.deleteDatabase(e)).toPromise()}static v(){if(!Up())return!1;if(tn.F())return!0;const e=Ye(),t=tn.M(e),r=0<t&&t<10,s=$g(e),i=0<s&&s<4.5;return!(e.indexOf("MSIE ")>0||e.indexOf("Trident/")>0||e.indexOf("Edge/")>0||r||i)}static F(){var e;return typeof process<"u"&&((e=process.__PRIVATE_env)==null?void 0:e.__PRIVATE_USE_MOCK_PERSISTENCE)==="YES"}static O(e,t){return e.store(t)}static M(e){const t=e.match(/i(?:phone|pad|pod) os ([\d_]+)/i),r=t?t[1].split("_").slice(0,2).join("."):"-1";return Number(r)}constructor(e,t,r){this.name=e,this.version=t,this.N=r,this.B=null,tn.M(Ye())===12.2&&qe("Firestore persistence suffers from a bug in iOS 12.2 Safari that may cause your app to stop working. See https://stackoverflow.com/q/56496296/110915 for details and a potential workaround.")}async L(e){return this.db||(x(Tt,"Opening database:",this.name),this.db=await new Promise(((t,r)=>{const s=indexedDB.open(this.name,this.version);s.onsuccess=i=>{const o=i.target.result;t(o)},s.onblocked=()=>{r(new go(e,"Cannot upgrade IndexedDB schema while another tab is open. Close all tabs that access Firestore and reload this page to proceed."))},s.onerror=i=>{const o=i.target.error;o.name==="VersionError"?r(new D(k.FAILED_PRECONDITION,"A newer version of the Firestore SDK was previously used and so the persisted data is not compatible with the version of the SDK you are now using. The SDK will operate with persistence disabled. If you need persistence, please re-upgrade to a newer version of the SDK or else clear the persisted IndexedDB data for your app to start fresh.")):o.name==="InvalidStateError"?r(new D(k.FAILED_PRECONDITION,"Unable to open an IndexedDB connection. This could be due to running in a private browsing session on a browser whose private browsing sessions do not support IndexedDB: "+o)):r(new go(e,o))},s.onupgradeneeded=i=>{x(Tt,'Database "'+this.name+'" requires upgrade from version:',i.oldVersion);const o=i.target.result;this.N.k(o,s.transaction,i.oldVersion,this.version).next((()=>{x(Tt,"Database upgrade to version "+this.version+" complete")}))}}))),this.q&&(this.db.onversionchange=t=>this.q(t)),this.db}K(e){this.q=e,this.db&&(this.db.onversionchange=t=>e(t))}async runTransaction(e,t,r,s){const i=t==="readonly";let o=0;for(;;){++o;try{this.db=await this.L(e);const a=Fc.open(this.db,e,i?"readonly":"readwrite",r),u=s(a).next((l=>(a.C(),l))).catch((l=>(a.abort(l),S.reject(l)))).toPromise();return u.catch((()=>{})),await a.D,u}catch(a){const u=a,l=u.name!=="FirebaseError"&&o<3;if(x(Tt,"Transaction failed with error:",u.message,"Retrying:",l),this.close(),!l)return Promise.reject(u)}}}close(){this.db&&this.db.close(),this.db=void 0}}function $g(n){const e=n.match(/Android ([\d.]+)/i),t=e?e[1].split(".").slice(0,2).join("."):"-1";return Number(t)}class Wv{constructor(e){this.U=e,this.$=!1,this.W=null}get isDone(){return this.$}get G(){return this.W}set cursor(e){this.U=e}done(){this.$=!0}j(e){this.W=e}delete(){return Br(this.U.delete())}}class go extends D{constructor(e,t){super(k.UNAVAILABLE,`IndexedDB transaction '${e}' failed: ${t}`),this.name="IndexedDbTransactionError"}}function Ir(n){return n.name==="IndexedDbTransactionError"}class Hv{constructor(e){this.store=e}put(e,t){let r;return t!==void 0?(x(Tt,"PUT",this.store.name,e,t),r=this.store.put(t,e)):(x(Tt,"PUT",this.store.name,"<auto-key>",e),r=this.store.put(e)),Br(r)}add(e){return x(Tt,"ADD",this.store.name,e,e),Br(this.store.add(e))}get(e){return Br(this.store.get(e)).next((t=>(t===void 0&&(t=null),x(Tt,"GET",this.store.name,e,t),t)))}delete(e){return x(Tt,"DELETE",this.store.name,e),Br(this.store.delete(e))}count(){return x(Tt,"COUNT",this.store.name),Br(this.store.count())}J(e,t){const r=this.options(e,t),s=r.index?this.store.index(r.index):this.store;if(typeof s.getAll=="function"){const i=s.getAll(r.range);return new S(((o,a)=>{i.onerror=u=>{a(u.target.error)},i.onsuccess=u=>{o(u.target.result)}}))}{const i=this.cursor(r),o=[];return this.H(i,((a,u)=>{o.push(u)})).next((()=>o))}}Z(e,t){const r=this.store.getAll(e,t===null?void 0:t);return new S(((s,i)=>{r.onerror=o=>{i(o.target.error)},r.onsuccess=o=>{s(o.target.result)}}))}X(e,t){x(Tt,"DELETE ALL",this.store.name);const r=this.options(e,t);r.Y=!1;const s=this.cursor(r);return this.H(s,((i,o,a)=>a.delete()))}ee(e,t){let r;t?r=e:(r={},t=e);const s=this.cursor(r);return this.H(s,t)}te(e){const t=this.cursor({});return new S(((r,s)=>{t.onerror=i=>{const o=rh(i.target.error);s(o)},t.onsuccess=i=>{const o=i.target.result;o?e(o.primaryKey,o.value).next((a=>{a?o.continue():r()})):r()}}))}H(e,t){const r=[];return new S(((s,i)=>{e.onerror=o=>{i(o.target.error)},e.onsuccess=o=>{const a=o.target.result;if(!a)return void s();const u=new Wv(a),l=t(a.primaryKey,a.value,u);if(l instanceof S){const h=l.catch((f=>(u.done(),S.reject(f))));r.push(h)}u.isDone?s():u.G===null?a.continue():a.continue(u.G)}})).next((()=>S.waitFor(r)))}options(e,t){let r;return e!==void 0&&(typeof e=="string"?r=e:t=e),{index:r,range:t}}cursor(e){let t="next";if(e.reverse&&(t="prev"),e.index){const r=this.store.index(e.index);return e.Y?r.openKeyCursor(e.range,t):r.openCursor(e.range,t)}return this.store.openCursor(e.range,t)}}function Br(n){return new S(((e,t)=>{n.onsuccess=r=>{const s=r.target.result;e(s)},n.onerror=r=>{const s=rh(r.target.error);t(s)}}))}let Kf=!1;function rh(n){const e=tn.M(Ye());if(e>=12.2&&e<13){const t="An internal error was encountered in the Indexed Database server";if(n.message.indexOf(t)>=0){const r=new D("internal",`IOS_INDEXEDDB_BUG1: IndexedDb has thrown '${t}'. This is likely due to an unavoidable bug in iOS. See https://stackoverflow.com/q/56496296/110915 for details and a potential workaround.`);return Kf||(Kf=!0,setTimeout((()=>{throw r}),0)),r}}return n}const _o="IndexBackfiller";class Qv{constructor(e,t){this.asyncQueue=e,this.ne=t,this.task=null}start(){this.re(15e3)}stop(){this.task&&(this.task.cancel(),this.task=null)}get started(){return this.task!==null}re(e){x(_o,`Scheduled in ${e}ms`),this.task=this.asyncQueue.enqueueAfterDelay("index_backfill",e,(async()=>{this.task=null;try{const t=await this.ne.ie();x(_o,`Documents written: ${t}`)}catch(t){Ir(t)?x(_o,"Ignoring IndexedDB error during index backfill: ",t):await yr(t)}await this.re(6e4)}))}}class Jv{constructor(e,t){this.localStore=e,this.persistence=t}async ie(e=50){return this.persistence.runTransaction("Backfill Indexes","readwrite-primary",(t=>this.se(t,e)))}se(e,t){const r=new Set;let s=t,i=!0;return S.doWhile((()=>i===!0&&s>0),(()=>this.localStore.indexManager.getNextCollectionGroupToUpdate(e).next((o=>{if(o!==null&&!r.has(o))return x(_o,`Processing collection: ${o}`),this.oe(e,o,s).next((a=>{s-=a,r.add(o)}));i=!1})))).next((()=>t-s))}oe(e,t,r){return this.localStore.indexManager.getMinOffsetFromCollectionGroup(e,t).next((s=>this.localStore.localDocuments.getNextDocuments(e,t,s,r).next((i=>{const o=i.changes;return this.localStore.indexManager.updateIndexEntries(e,o).next((()=>this._e(s,i))).next((a=>(x(_o,`Updating offset: ${a}`),this.localStore.indexManager.updateCollectionGroup(e,t,a)))).next((()=>o.size))}))))}_e(e,t){let r=e;return t.changes.forEach(((s,i)=>{const o=Bg(i);nh(o,r)>0&&(r=o)})),new Pt(r.readTime,r.documentKey,Math.max(t.batchId,e.largestBatchId))}}/**
 * @license
 * Copyright 2018 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class gt{constructor(e,t){this.previousValue=e,t&&(t.sequenceNumberHandler=r=>this.ae(r),this.ue=r=>t.writeSequenceNumber(r))}ae(e){return this.previousValue=Math.max(e,this.previousValue),this.previousValue}next(){const e=++this.previousValue;return this.ue&&this.ue(e),e}}gt.ce=-1;/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const or=-1;function ea(n){return n==null}function No(n){return n===0&&1/n==-1/0}function qg(n){return typeof n=="number"&&Number.isInteger(n)&&!No(n)&&n<=Number.MAX_SAFE_INTEGER&&n>=Number.MIN_SAFE_INTEGER}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const dc="";function ht(n){let e="";for(let t=0;t<n.length;t++)e.length>0&&(e=Wf(e)),e=Yv(n.get(t),e);return Wf(e)}function Yv(n,e){let t=e;const r=n.length;for(let s=0;s<r;s++){const i=n.charAt(s);switch(i){case"\0":t+="";break;case dc:t+="";break;default:t+=i}}return t}function Wf(n){return n+dc+""}function Ht(n){const e=n.length;if(K(e>=2,64408,{path:n}),e===2)return K(n.charAt(0)===dc&&n.charAt(1)==="",56145,{path:n}),oe.emptyPath();const t=e-2,r=[];let s="";for(let i=0;i<e;){const o=n.indexOf(dc,i);switch((o<0||o>t)&&j(50515,{path:n}),n.charAt(o+1)){case"":const a=n.substring(i,o);let u;s.length===0?u=a:(s+=a,u=s,s=""),r.push(u);break;case"":s+=n.substring(i,o),s+="\0";break;case"":s+=n.substring(i,o+1);break;default:j(61167,{path:n})}i=o+2}return new oe(r)}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Lr="remoteDocuments",ta="owner",vs="owner",Do="mutationQueues",Xv="userId",Ot="mutations",Hf="batchId",qr="userMutationsIndex",Qf=["userId","batchId"];/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Ka(n,e){return[n,ht(e)]}function jg(n,e,t){return[n,ht(e),t]}const Zv={},Qs="documentMutations",fc="remoteDocumentsV14",eb=["prefixPath","collectionGroup","readTime","documentId"],Wa="documentKeyIndex",tb=["prefixPath","collectionGroup","documentId"],Gg="collectionGroupIndex",nb=["collectionGroup","readTime","prefixPath","documentId"],Vo="remoteDocumentGlobal",dl="remoteDocumentGlobalKey",Js="targets",zg="queryTargetsIndex",rb=["canonicalId","targetId"],Ys="targetDocuments",sb=["targetId","path"],sh="documentTargetsIndex",ib=["path","targetId"],mc="targetGlobalKey",Gr="targetGlobal",Oo="collectionParents",ob=["collectionId","parent"],Xs="clientMetadata",ab="clientId",Uc="bundles",cb="bundleId",$c="namedQueries",ub="name",ih="indexConfiguration",lb="indexId",fl="collectionGroupIndex",hb="collectionGroup",yo="indexState",db=["indexId","uid"],Kg="sequenceNumberIndex",fb=["uid","sequenceNumber"],Io="indexEntries",mb=["indexId","uid","arrayValue","directionalValue","orderedDocumentKey","documentKey"],Wg="documentKeyIndex",pb=["indexId","uid","orderedDocumentKey"],qc="documentOverlays",gb=["userId","collectionPath","documentId"],ml="collectionPathOverlayIndex",_b=["userId","collectionPath","largestBatchId"],Hg="collectionGroupOverlayIndex",yb=["userId","collectionGroup","largestBatchId"],oh="globals",Ib="name",Qg=[Do,Ot,Qs,Lr,Js,ta,Gr,Ys,Xs,Vo,Oo,Uc,$c],wb=[...Qg,qc],Jg=[Do,Ot,Qs,fc,Js,ta,Gr,Ys,Xs,Vo,Oo,Uc,$c,qc],Yg=Jg,ah=[...Yg,ih,yo,Io],Eb=ah,Xg=[...ah,oh],Tb=Xg;/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class pl extends Ug{constructor(e,t){super(),this.le=e,this.currentSequenceNumber=t}}function Ze(n,e){const t=F(n);return tn.O(t.le,e)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Jf(n){let e=0;for(const t in n)Object.prototype.hasOwnProperty.call(n,t)&&e++;return e}function wr(n,e){for(const t in n)Object.prototype.hasOwnProperty.call(n,t)&&e(t,n[t])}function Zg(n,e){const t=[];for(const r in n)Object.prototype.hasOwnProperty.call(n,r)&&t.push(e(n[r],r,n));return t}function e_(n){for(const e in n)if(Object.prototype.hasOwnProperty.call(n,e))return!1;return!0}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ve{constructor(e,t){this.comparator=e,this.root=t||at.EMPTY}insert(e,t){return new ve(this.comparator,this.root.insert(e,t,this.comparator).copy(null,null,at.BLACK,null,null))}remove(e){return new ve(this.comparator,this.root.remove(e,this.comparator).copy(null,null,at.BLACK,null,null))}get(e){let t=this.root;for(;!t.isEmpty();){const r=this.comparator(e,t.key);if(r===0)return t.value;r<0?t=t.left:r>0&&(t=t.right)}return null}indexOf(e){let t=0,r=this.root;for(;!r.isEmpty();){const s=this.comparator(e,r.key);if(s===0)return t+r.left.size;s<0?r=r.left:(t+=r.left.size+1,r=r.right)}return-1}isEmpty(){return this.root.isEmpty()}get size(){return this.root.size}minKey(){return this.root.minKey()}maxKey(){return this.root.maxKey()}inorderTraversal(e){return this.root.inorderTraversal(e)}forEach(e){this.inorderTraversal(((t,r)=>(e(t,r),!1)))}toString(){const e=[];return this.inorderTraversal(((t,r)=>(e.push(`${t}:${r}`),!1))),`{${e.join(", ")}}`}reverseTraversal(e){return this.root.reverseTraversal(e)}getIterator(){return new Na(this.root,null,this.comparator,!1)}getIteratorFrom(e){return new Na(this.root,e,this.comparator,!1)}getReverseIterator(){return new Na(this.root,null,this.comparator,!0)}getReverseIteratorFrom(e){return new Na(this.root,e,this.comparator,!0)}}class Na{constructor(e,t,r,s){this.isReverse=s,this.nodeStack=[];let i=1;for(;!e.isEmpty();)if(i=t?r(e.key,t):1,t&&s&&(i*=-1),i<0)e=this.isReverse?e.left:e.right;else{if(i===0){this.nodeStack.push(e);break}this.nodeStack.push(e),e=this.isReverse?e.right:e.left}}getNext(){let e=this.nodeStack.pop();const t={key:e.key,value:e.value};if(this.isReverse)for(e=e.left;!e.isEmpty();)this.nodeStack.push(e),e=e.right;else for(e=e.right;!e.isEmpty();)this.nodeStack.push(e),e=e.left;return t}hasNext(){return this.nodeStack.length>0}peek(){if(this.nodeStack.length===0)return null;const e=this.nodeStack[this.nodeStack.length-1];return{key:e.key,value:e.value}}}class at{constructor(e,t,r,s,i){this.key=e,this.value=t,this.color=r??at.RED,this.left=s??at.EMPTY,this.right=i??at.EMPTY,this.size=this.left.size+1+this.right.size}copy(e,t,r,s,i){return new at(e??this.key,t??this.value,r??this.color,s??this.left,i??this.right)}isEmpty(){return!1}inorderTraversal(e){return this.left.inorderTraversal(e)||e(this.key,this.value)||this.right.inorderTraversal(e)}reverseTraversal(e){return this.right.reverseTraversal(e)||e(this.key,this.value)||this.left.reverseTraversal(e)}min(){return this.left.isEmpty()?this:this.left.min()}minKey(){return this.min().key}maxKey(){return this.right.isEmpty()?this.key:this.right.maxKey()}insert(e,t,r){let s=this;const i=r(e,s.key);return s=i<0?s.copy(null,null,null,s.left.insert(e,t,r),null):i===0?s.copy(null,t,null,null,null):s.copy(null,null,null,null,s.right.insert(e,t,r)),s.fixUp()}removeMin(){if(this.left.isEmpty())return at.EMPTY;let e=this;return e.left.isRed()||e.left.left.isRed()||(e=e.moveRedLeft()),e=e.copy(null,null,null,e.left.removeMin(),null),e.fixUp()}remove(e,t){let r,s=this;if(t(e,s.key)<0)s.left.isEmpty()||s.left.isRed()||s.left.left.isRed()||(s=s.moveRedLeft()),s=s.copy(null,null,null,s.left.remove(e,t),null);else{if(s.left.isRed()&&(s=s.rotateRight()),s.right.isEmpty()||s.right.isRed()||s.right.left.isRed()||(s=s.moveRedRight()),t(e,s.key)===0){if(s.right.isEmpty())return at.EMPTY;r=s.right.min(),s=s.copy(r.key,r.value,null,null,s.right.removeMin())}s=s.copy(null,null,null,null,s.right.remove(e,t))}return s.fixUp()}isRed(){return this.color}fixUp(){let e=this;return e.right.isRed()&&!e.left.isRed()&&(e=e.rotateLeft()),e.left.isRed()&&e.left.left.isRed()&&(e=e.rotateRight()),e.left.isRed()&&e.right.isRed()&&(e=e.colorFlip()),e}moveRedLeft(){let e=this.colorFlip();return e.right.left.isRed()&&(e=e.copy(null,null,null,null,e.right.rotateRight()),e=e.rotateLeft(),e=e.colorFlip()),e}moveRedRight(){let e=this.colorFlip();return e.left.left.isRed()&&(e=e.rotateRight(),e=e.colorFlip()),e}rotateLeft(){const e=this.copy(null,null,at.RED,null,this.right.left);return this.right.copy(null,null,this.color,e,null)}rotateRight(){const e=this.copy(null,null,at.RED,this.left.right,null);return this.left.copy(null,null,this.color,null,e)}colorFlip(){const e=this.left.copy(null,null,!this.left.color,null,null),t=this.right.copy(null,null,!this.right.color,null,null);return this.copy(null,null,!this.color,e,t)}checkMaxDepth(){const e=this.check();return Math.pow(2,e)<=this.size+1}check(){if(this.isRed()&&this.left.isRed())throw j(43730,{key:this.key,value:this.value});if(this.right.isRed())throw j(14113,{key:this.key,value:this.value});const e=this.left.check();if(e!==this.right.check())throw j(27949);return e+(this.isRed()?0:1)}}at.EMPTY=null,at.RED=!0,at.BLACK=!1;at.EMPTY=new class{constructor(){this.size=0}get key(){throw j(57766)}get value(){throw j(16141)}get color(){throw j(16727)}get left(){throw j(29726)}get right(){throw j(36894)}copy(e,t,r,s,i){return this}insert(e,t,r){return new at(e,t)}remove(e,t){return this}isEmpty(){return!0}inorderTraversal(e){return!1}reverseTraversal(e){return!1}minKey(){return null}maxKey(){return null}isRed(){return!1}checkMaxDepth(){return!0}check(){return 0}};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Ie{constructor(e){this.comparator=e,this.data=new ve(this.comparator)}has(e){return this.data.get(e)!==null}first(){return this.data.minKey()}last(){return this.data.maxKey()}get size(){return this.data.size}indexOf(e){return this.data.indexOf(e)}forEach(e){this.data.inorderTraversal(((t,r)=>(e(t),!1)))}forEachInRange(e,t){const r=this.data.getIteratorFrom(e[0]);for(;r.hasNext();){const s=r.getNext();if(this.comparator(s.key,e[1])>=0)return;t(s.key)}}forEachWhile(e,t){let r;for(r=t!==void 0?this.data.getIteratorFrom(t):this.data.getIterator();r.hasNext();)if(!e(r.getNext().key))return}firstAfterOrEqual(e){const t=this.data.getIteratorFrom(e);return t.hasNext()?t.getNext().key:null}getIterator(){return new Yf(this.data.getIterator())}getIteratorFrom(e){return new Yf(this.data.getIteratorFrom(e))}add(e){return this.copy(this.data.remove(e).insert(e,!0))}delete(e){return this.has(e)?this.copy(this.data.remove(e)):this}isEmpty(){return this.data.isEmpty()}unionWith(e){let t=this;return t.size<e.size&&(t=e,e=this),e.forEach((r=>{t=t.add(r)})),t}isEqual(e){if(!(e instanceof Ie)||this.size!==e.size)return!1;const t=this.data.getIterator(),r=e.data.getIterator();for(;t.hasNext();){const s=t.getNext().key,i=r.getNext().key;if(this.comparator(s,i)!==0)return!1}return!0}toArray(){const e=[];return this.forEach((t=>{e.push(t)})),e}toString(){const e=[];return this.forEach((t=>e.push(t))),"SortedSet("+e.toString()+")"}copy(e){const t=new Ie(this.comparator);return t.data=e,t}}class Yf{constructor(e){this.iter=e}getNext(){return this.iter.getNext().key}hasNext(){return this.iter.hasNext()}}function bs(n){return n.hasNext()?n.getNext():void 0}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class _t{constructor(e){this.fields=e,e.sort(Ve.comparator)}static empty(){return new _t([])}unionWith(e){let t=new Ie(Ve.comparator);for(const r of this.fields)t=t.add(r);for(const r of e)t=t.add(r);return new _t(t.toArray())}covers(e){for(const t of this.fields)if(t.isPrefixOf(e))return!0;return!1}isEqual(e){return zs(this.fields,e.fields,((t,r)=>t.isEqual(r)))}}/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class t_ extends Error{constructor(){super(...arguments),this.name="Base64DecodeError"}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function F0(){return typeof atob<"u"}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Fe{constructor(e){this.binaryString=e}static fromBase64String(e){const t=(function(s){try{return atob(s)}catch(i){throw typeof DOMException<"u"&&i instanceof DOMException?new t_("Invalid base64 string: "+i):i}})(e);return new Fe(t)}static fromUint8Array(e){const t=(function(s){let i="";for(let o=0;o<s.length;++o)i+=String.fromCharCode(s[o]);return i})(e);return new Fe(t)}[Symbol.iterator](){let e=0;return{next:()=>e<this.binaryString.length?{value:this.binaryString.charCodeAt(e++),done:!1}:{value:void 0,done:!0}}}toBase64(){return(function(t){return btoa(t)})(this.binaryString)}toUint8Array(){return(function(t){const r=new Uint8Array(t.length);for(let s=0;s<t.length;s++)r[s]=t.charCodeAt(s);return r})(this.binaryString)}approximateByteSize(){return 2*this.binaryString.length}compareTo(e){return Z(this.binaryString,e.binaryString)}isEqual(e){return this.binaryString===e.binaryString}}Fe.EMPTY_BYTE_STRING=new Fe("");const Ab=new RegExp(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.(\d+))?Z$/);function In(n){if(K(!!n,39018),typeof n=="string"){let e=0;const t=Ab.exec(n);if(K(!!t,46558,{timestamp:n}),t[1]){let s=t[1];s=(s+"000000000").substr(0,9),e=Number(s)}const r=new Date(n);return{seconds:Math.floor(r.getTime()/1e3),nanos:e}}return{seconds:De(n.seconds),nanos:De(n.nanos)}}function De(n){return typeof n=="number"?n:typeof n=="string"?Number(n):0}function wn(n){return typeof n=="string"?Fe.fromBase64String(n):Fe.fromUint8Array(n)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const n_="server_timestamp",r_="__type__",s_="__previous_value__",i_="__local_write_time__";function jc(n){var t,r;return((r=(((t=n==null?void 0:n.mapValue)==null?void 0:t.fields)||{})[r_])==null?void 0:r.stringValue)===n_}function Gc(n){const e=n.mapValue.fields[s_];return jc(e)?Gc(e):e}function xo(n){const e=In(n.mapValue.fields[i_].timestampValue);return new _e(e.seconds,e.nanos)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class vb{constructor(e,t,r,s,i,o,a,u,l,h,f){this.databaseId=e,this.appId=t,this.persistenceKey=r,this.host=s,this.ssl=i,this.forceLongPolling=o,this.autoDetectLongPolling=a,this.longPollingOptions=u,this.useFetchStreams=l,this.isUsingEmulator=h,this.apiKey=f}}const Mo="(default)";class Qr{constructor(e,t){this.projectId=e,this.database=t||Mo}static empty(){return new Qr("","")}get isDefaultDatabase(){return this.database===Mo}isEqual(e){return e instanceof Qr&&e.projectId===this.projectId&&e.database===this.database}}function bb(n,e){if(!Object.prototype.hasOwnProperty.apply(n.options,["projectId"]))throw new D(k.INVALID_ARGUMENT,'"projectId" not provided in firebase.initializeApp.');return new Qr(n.options.projectId,e)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const ch="__type__",o_="__max__",Xn={mapValue:{fields:{__type__:{stringValue:o_}}}},uh="__vector__",Zs="value",Ha={nullValue:"NULL_VALUE"};function ur(n){return"nullValue"in n?0:"booleanValue"in n?1:"integerValue"in n||"doubleValue"in n?2:"timestampValue"in n?3:"stringValue"in n?5:"bytesValue"in n?6:"referenceValue"in n?7:"geoPointValue"in n?8:"arrayValue"in n?9:"mapValue"in n?jc(n)?4:c_(n)?9007199254740991:zc(n)?10:11:j(28295,{value:n})}function an(n,e){if(n===e)return!0;const t=ur(n);if(t!==ur(e))return!1;switch(t){case 0:case 9007199254740991:return!0;case 1:return n.booleanValue===e.booleanValue;case 4:return xo(n).isEqual(xo(e));case 3:return(function(s,i){if(typeof s.timestampValue=="string"&&typeof i.timestampValue=="string"&&s.timestampValue.length===i.timestampValue.length)return s.timestampValue===i.timestampValue;const o=In(s.timestampValue),a=In(i.timestampValue);return o.seconds===a.seconds&&o.nanos===a.nanos})(n,e);case 5:return n.stringValue===e.stringValue;case 6:return(function(s,i){return wn(s.bytesValue).isEqual(wn(i.bytesValue))})(n,e);case 7:return n.referenceValue===e.referenceValue;case 8:return(function(s,i){return De(s.geoPointValue.latitude)===De(i.geoPointValue.latitude)&&De(s.geoPointValue.longitude)===De(i.geoPointValue.longitude)})(n,e);case 2:return(function(s,i){if("integerValue"in s&&"integerValue"in i)return De(s.integerValue)===De(i.integerValue);if("doubleValue"in s&&"doubleValue"in i){const o=De(s.doubleValue),a=De(i.doubleValue);return o===a?No(o)===No(a):isNaN(o)&&isNaN(a)}return!1})(n,e);case 9:return zs(n.arrayValue.values||[],e.arrayValue.values||[],an);case 10:case 11:return(function(s,i){const o=s.mapValue.fields||{},a=i.mapValue.fields||{};if(Jf(o)!==Jf(a))return!1;for(const u in o)if(o.hasOwnProperty(u)&&(a[u]===void 0||!an(o[u],a[u])))return!1;return!0})(n,e);default:return j(52216,{left:n})}}function Lo(n,e){return(n.values||[]).find((t=>an(t,e)))!==void 0}function lr(n,e){if(n===e)return 0;const t=ur(n),r=ur(e);if(t!==r)return Z(t,r);switch(t){case 0:case 9007199254740991:return 0;case 1:return Z(n.booleanValue,e.booleanValue);case 2:return(function(i,o){const a=De(i.integerValue||i.doubleValue),u=De(o.integerValue||o.doubleValue);return a<u?-1:a>u?1:a===u?0:isNaN(a)?isNaN(u)?0:-1:1})(n,e);case 3:return Xf(n.timestampValue,e.timestampValue);case 4:return Xf(xo(n),xo(e));case 5:return ul(n.stringValue,e.stringValue);case 6:return(function(i,o){const a=wn(i),u=wn(o);return a.compareTo(u)})(n.bytesValue,e.bytesValue);case 7:return(function(i,o){const a=i.split("/"),u=o.split("/");for(let l=0;l<a.length&&l<u.length;l++){const h=Z(a[l],u[l]);if(h!==0)return h}return Z(a.length,u.length)})(n.referenceValue,e.referenceValue);case 8:return(function(i,o){const a=Z(De(i.latitude),De(o.latitude));return a!==0?a:Z(De(i.longitude),De(o.longitude))})(n.geoPointValue,e.geoPointValue);case 9:return Zf(n.arrayValue,e.arrayValue);case 10:return(function(i,o){var p,_,w,b;const a=i.fields||{},u=o.fields||{},l=(p=a[Zs])==null?void 0:p.arrayValue,h=(_=u[Zs])==null?void 0:_.arrayValue,f=Z(((w=l==null?void 0:l.values)==null?void 0:w.length)||0,((b=h==null?void 0:h.values)==null?void 0:b.length)||0);return f!==0?f:Zf(l,h)})(n.mapValue,e.mapValue);case 11:return(function(i,o){if(i===Xn.mapValue&&o===Xn.mapValue)return 0;if(i===Xn.mapValue)return 1;if(o===Xn.mapValue)return-1;const a=i.fields||{},u=Object.keys(a),l=o.fields||{},h=Object.keys(l);u.sort(),h.sort();for(let f=0;f<u.length&&f<h.length;++f){const p=ul(u[f],h[f]);if(p!==0)return p;const _=lr(a[u[f]],l[h[f]]);if(_!==0)return _}return Z(u.length,h.length)})(n.mapValue,e.mapValue);default:throw j(23264,{he:t})}}function Xf(n,e){if(typeof n=="string"&&typeof e=="string"&&n.length===e.length)return Z(n,e);const t=In(n),r=In(e),s=Z(t.seconds,r.seconds);return s!==0?s:Z(t.nanos,r.nanos)}function Zf(n,e){const t=n.values||[],r=e.values||[];for(let s=0;s<t.length&&s<r.length;++s){const i=lr(t[s],r[s]);if(i)return i}return Z(t.length,r.length)}function ei(n){return gl(n)}function gl(n){return"nullValue"in n?"null":"booleanValue"in n?""+n.booleanValue:"integerValue"in n?""+n.integerValue:"doubleValue"in n?""+n.doubleValue:"timestampValue"in n?(function(t){const r=In(t);return`time(${r.seconds},${r.nanos})`})(n.timestampValue):"stringValue"in n?n.stringValue:"bytesValue"in n?(function(t){return wn(t).toBase64()})(n.bytesValue):"referenceValue"in n?(function(t){return B.fromName(t).toString()})(n.referenceValue):"geoPointValue"in n?(function(t){return`geo(${t.latitude},${t.longitude})`})(n.geoPointValue):"arrayValue"in n?(function(t){let r="[",s=!0;for(const i of t.values||[])s?s=!1:r+=",",r+=gl(i);return r+"]"})(n.arrayValue):"mapValue"in n?(function(t){const r=Object.keys(t.fields||{}).sort();let s="{",i=!0;for(const o of r)i?i=!1:s+=",",s+=`${o}:${gl(t.fields[o])}`;return s+"}"})(n.mapValue):j(61005,{value:n})}function Qa(n){switch(ur(n)){case 0:case 1:return 4;case 2:return 8;case 3:case 8:return 16;case 4:const e=Gc(n);return e?16+Qa(e):16;case 5:return 2*n.stringValue.length;case 6:return wn(n.bytesValue).approximateByteSize();case 7:return n.referenceValue.length;case 9:return(function(r){return(r.values||[]).reduce(((s,i)=>s+Qa(i)),0)})(n.arrayValue);case 10:case 11:return(function(r){let s=0;return wr(r.fields,((i,o)=>{s+=i.length+Qa(o)})),s})(n.mapValue);default:throw j(13486,{value:n})}}function Jr(n,e){return{referenceValue:`projects/${n.projectId}/databases/${n.database}/documents/${e.path.canonicalString()}`}}function Bo(n){return!!n&&"integerValue"in n}function a_(n){return Bo(n)||(function(t){return!!t&&"doubleValue"in t})(n)}function Fo(n){return!!n&&"arrayValue"in n}function em(n){return!!n&&"nullValue"in n}function tm(n){return!!n&&"doubleValue"in n&&isNaN(Number(n.doubleValue))}function Ja(n){return!!n&&"mapValue"in n}function zc(n){var t,r;return((r=(((t=n==null?void 0:n.mapValue)==null?void 0:t.fields)||{})[ch])==null?void 0:r.stringValue)===uh}function wo(n){if(n.geoPointValue)return{geoPointValue:{...n.geoPointValue}};if(n.timestampValue&&typeof n.timestampValue=="object")return{timestampValue:{...n.timestampValue}};if(n.mapValue){const e={mapValue:{fields:{}}};return wr(n.mapValue.fields,((t,r)=>e.mapValue.fields[t]=wo(r))),e}if(n.arrayValue){const e={arrayValue:{values:[]}};for(let t=0;t<(n.arrayValue.values||[]).length;++t)e.arrayValue.values[t]=wo(n.arrayValue.values[t]);return e}return{...n}}function c_(n){return(((n.mapValue||{}).fields||{}).__type__||{}).stringValue===o_}const u_={mapValue:{fields:{[ch]:{stringValue:uh},[Zs]:{arrayValue:{}}}}};function Sb(n){return"nullValue"in n?Ha:"booleanValue"in n?{booleanValue:!1}:"integerValue"in n||"doubleValue"in n?{doubleValue:NaN}:"timestampValue"in n?{timestampValue:{seconds:Number.MIN_SAFE_INTEGER}}:"stringValue"in n?{stringValue:""}:"bytesValue"in n?{bytesValue:""}:"referenceValue"in n?Jr(Qr.empty(),B.empty()):"geoPointValue"in n?{geoPointValue:{latitude:-90,longitude:-180}}:"arrayValue"in n?{arrayValue:{}}:"mapValue"in n?zc(n)?u_:{mapValue:{}}:j(35942,{value:n})}function Rb(n){return"nullValue"in n?{booleanValue:!1}:"booleanValue"in n?{doubleValue:NaN}:"integerValue"in n||"doubleValue"in n?{timestampValue:{seconds:Number.MIN_SAFE_INTEGER}}:"timestampValue"in n?{stringValue:""}:"stringValue"in n?{bytesValue:""}:"bytesValue"in n?Jr(Qr.empty(),B.empty()):"referenceValue"in n?{geoPointValue:{latitude:-90,longitude:-180}}:"geoPointValue"in n?{arrayValue:{}}:"arrayValue"in n?u_:"mapValue"in n?zc(n)?{mapValue:{}}:Xn:j(61959,{value:n})}function nm(n,e){const t=lr(n.value,e.value);return t!==0?t:n.inclusive&&!e.inclusive?-1:!n.inclusive&&e.inclusive?1:0}function rm(n,e){const t=lr(n.value,e.value);return t!==0?t:n.inclusive&&!e.inclusive?1:!n.inclusive&&e.inclusive?-1:0}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class rt{constructor(e){this.value=e}static empty(){return new rt({mapValue:{}})}field(e){if(e.isEmpty())return this.value;{let t=this.value;for(let r=0;r<e.length-1;++r)if(t=(t.mapValue.fields||{})[e.get(r)],!Ja(t))return null;return t=(t.mapValue.fields||{})[e.lastSegment()],t||null}}set(e,t){this.getFieldsMap(e.popLast())[e.lastSegment()]=wo(t)}setAll(e){let t=Ve.emptyPath(),r={},s=[];e.forEach(((o,a)=>{if(!t.isImmediateParentOf(a)){const u=this.getFieldsMap(t);this.applyChanges(u,r,s),r={},s=[],t=a.popLast()}o?r[a.lastSegment()]=wo(o):s.push(a.lastSegment())}));const i=this.getFieldsMap(t);this.applyChanges(i,r,s)}delete(e){const t=this.field(e.popLast());Ja(t)&&t.mapValue.fields&&delete t.mapValue.fields[e.lastSegment()]}isEqual(e){return an(this.value,e.value)}getFieldsMap(e){let t=this.value;t.mapValue.fields||(t.mapValue={fields:{}});for(let r=0;r<e.length;++r){let s=t.mapValue.fields[e.get(r)];Ja(s)&&s.mapValue.fields||(s={mapValue:{fields:{}}},t.mapValue.fields[e.get(r)]=s),t=s}return t.mapValue.fields}applyChanges(e,t,r){wr(t,((s,i)=>e[s]=i));for(const s of r)delete e[s]}clone(){return new rt(wo(this.value))}}function l_(n){const e=[];return wr(n.fields,((t,r)=>{const s=new Ve([t]);if(Ja(r)){const i=l_(r.mapValue).fields;if(i.length===0)e.push(s);else for(const o of i)e.push(s.child(o))}else e.push(s)})),new _t(e)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Ce{constructor(e,t,r,s,i,o,a){this.key=e,this.documentType=t,this.version=r,this.readTime=s,this.createTime=i,this.data=o,this.documentState=a}static newInvalidDocument(e){return new Ce(e,0,J.min(),J.min(),J.min(),rt.empty(),0)}static newFoundDocument(e,t,r,s){return new Ce(e,1,t,J.min(),r,s,0)}static newNoDocument(e,t){return new Ce(e,2,t,J.min(),J.min(),rt.empty(),0)}static newUnknownDocument(e,t){return new Ce(e,3,t,J.min(),J.min(),rt.empty(),2)}convertToFoundDocument(e,t){return!this.createTime.isEqual(J.min())||this.documentType!==2&&this.documentType!==0||(this.createTime=e),this.version=e,this.documentType=1,this.data=t,this.documentState=0,this}convertToNoDocument(e){return this.version=e,this.documentType=2,this.data=rt.empty(),this.documentState=0,this}convertToUnknownDocument(e){return this.version=e,this.documentType=3,this.data=rt.empty(),this.documentState=2,this}setHasCommittedMutations(){return this.documentState=2,this}setHasLocalMutations(){return this.documentState=1,this.version=J.min(),this}setReadTime(e){return this.readTime=e,this}get hasLocalMutations(){return this.documentState===1}get hasCommittedMutations(){return this.documentState===2}get hasPendingWrites(){return this.hasLocalMutations||this.hasCommittedMutations}isValidDocument(){return this.documentType!==0}isFoundDocument(){return this.documentType===1}isNoDocument(){return this.documentType===2}isUnknownDocument(){return this.documentType===3}isEqual(e){return e instanceof Ce&&this.key.isEqual(e.key)&&this.version.isEqual(e.version)&&this.documentType===e.documentType&&this.documentState===e.documentState&&this.data.isEqual(e.data)}mutableCopy(){return new Ce(this.key,this.documentType,this.version,this.readTime,this.createTime,this.data.clone(),this.documentState)}toString(){return`Document(${this.key}, ${this.version}, ${JSON.stringify(this.data.value)}, {createTime: ${this.createTime}}), {documentType: ${this.documentType}}), {documentState: ${this.documentState}})`}}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class hr{constructor(e,t){this.position=e,this.inclusive=t}}function sm(n,e,t){let r=0;for(let s=0;s<n.position.length;s++){const i=e[s],o=n.position[s];if(i.field.isKeyField()?r=B.comparator(B.fromName(o.referenceValue),t.key):r=lr(o,t.data.field(i.field)),i.dir==="desc"&&(r*=-1),r!==0)break}return r}function im(n,e){if(n===null)return e===null;if(e===null||n.inclusive!==e.inclusive||n.position.length!==e.position.length)return!1;for(let t=0;t<n.position.length;t++)if(!an(n.position[t],e.position[t]))return!1;return!0}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Uo{constructor(e,t="asc"){this.field=e,this.dir=t}}function Pb(n,e){return n.dir===e.dir&&n.field.isEqual(e.field)}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class h_{}class ue extends h_{constructor(e,t,r){super(),this.field=e,this.op=t,this.value=r}static create(e,t,r){return e.isKeyField()?t==="in"||t==="not-in"?this.createKeyFieldInFilter(e,t,r):new kb(e,t,r):t==="array-contains"?new Db(e,r):t==="in"?new __(e,r):t==="not-in"?new Vb(e,r):t==="array-contains-any"?new Ob(e,r):new ue(e,t,r)}static createKeyFieldInFilter(e,t,r){return t==="in"?new Cb(e,r):new Nb(e,r)}matches(e){const t=e.data.field(this.field);return this.op==="!="?t!==null&&t.nullValue===void 0&&this.matchesComparison(lr(t,this.value)):t!==null&&ur(this.value)===ur(t)&&this.matchesComparison(lr(t,this.value))}matchesComparison(e){switch(this.op){case"<":return e<0;case"<=":return e<=0;case"==":return e===0;case"!=":return e!==0;case">":return e>0;case">=":return e>=0;default:return j(47266,{operator:this.op})}}isInequality(){return["<","<=",">",">=","!=","not-in"].indexOf(this.op)>=0}getFlattenedFilters(){return[this]}getFilters(){return[this]}}class ye extends h_{constructor(e,t){super(),this.filters=e,this.op=t,this.Pe=null}static create(e,t){return new ye(e,t)}matches(e){return ti(this)?this.filters.find((t=>!t.matches(e)))===void 0:this.filters.find((t=>t.matches(e)))!==void 0}getFlattenedFilters(){return this.Pe!==null||(this.Pe=this.filters.reduce(((e,t)=>e.concat(t.getFlattenedFilters())),[])),this.Pe}getFilters(){return Object.assign([],this.filters)}}function ti(n){return n.op==="and"}function _l(n){return n.op==="or"}function lh(n){return d_(n)&&ti(n)}function d_(n){for(const e of n.filters)if(e instanceof ye)return!1;return!0}function yl(n){if(n instanceof ue)return n.field.canonicalString()+n.op.toString()+ei(n.value);if(lh(n))return n.filters.map((e=>yl(e))).join(",");{const e=n.filters.map((t=>yl(t))).join(",");return`${n.op}(${e})`}}function f_(n,e){return n instanceof ue?(function(r,s){return s instanceof ue&&r.op===s.op&&r.field.isEqual(s.field)&&an(r.value,s.value)})(n,e):n instanceof ye?(function(r,s){return s instanceof ye&&r.op===s.op&&r.filters.length===s.filters.length?r.filters.reduce(((i,o,a)=>i&&f_(o,s.filters[a])),!0):!1})(n,e):void j(19439)}function m_(n,e){const t=n.filters.concat(e);return ye.create(t,n.op)}function p_(n){return n instanceof ue?(function(t){return`${t.field.canonicalString()} ${t.op} ${ei(t.value)}`})(n):n instanceof ye?(function(t){return t.op.toString()+" {"+t.getFilters().map(p_).join(" ,")+"}"})(n):"Filter"}class kb extends ue{constructor(e,t,r){super(e,t,r),this.key=B.fromName(r.referenceValue)}matches(e){const t=B.comparator(e.key,this.key);return this.matchesComparison(t)}}class Cb extends ue{constructor(e,t){super(e,"in",t),this.keys=g_("in",t)}matches(e){return this.keys.some((t=>t.isEqual(e.key)))}}class Nb extends ue{constructor(e,t){super(e,"not-in",t),this.keys=g_("not-in",t)}matches(e){return!this.keys.some((t=>t.isEqual(e.key)))}}function g_(n,e){var t;return(((t=e.arrayValue)==null?void 0:t.values)||[]).map((r=>B.fromName(r.referenceValue)))}class Db extends ue{constructor(e,t){super(e,"array-contains",t)}matches(e){const t=e.data.field(this.field);return Fo(t)&&Lo(t.arrayValue,this.value)}}class __ extends ue{constructor(e,t){super(e,"in",t)}matches(e){const t=e.data.field(this.field);return t!==null&&Lo(this.value.arrayValue,t)}}class Vb extends ue{constructor(e,t){super(e,"not-in",t)}matches(e){if(Lo(this.value.arrayValue,{nullValue:"NULL_VALUE"}))return!1;const t=e.data.field(this.field);return t!==null&&t.nullValue===void 0&&!Lo(this.value.arrayValue,t)}}class Ob extends ue{constructor(e,t){super(e,"array-contains-any",t)}matches(e){const t=e.data.field(this.field);return!(!Fo(t)||!t.arrayValue.values)&&t.arrayValue.values.some((r=>Lo(this.value.arrayValue,r)))}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class xb{constructor(e,t=null,r=[],s=[],i=null,o=null,a=null){this.path=e,this.collectionGroup=t,this.orderBy=r,this.filters=s,this.limit=i,this.startAt=o,this.endAt=a,this.Te=null}}function Il(n,e=null,t=[],r=[],s=null,i=null,o=null){return new xb(n,e,t,r,s,i,o)}function Yr(n){const e=F(n);if(e.Te===null){let t=e.path.canonicalString();e.collectionGroup!==null&&(t+="|cg:"+e.collectionGroup),t+="|f:",t+=e.filters.map((r=>yl(r))).join(","),t+="|ob:",t+=e.orderBy.map((r=>(function(i){return i.field.canonicalString()+i.dir})(r))).join(","),ea(e.limit)||(t+="|l:",t+=e.limit),e.startAt&&(t+="|lb:",t+=e.startAt.inclusive?"b:":"a:",t+=e.startAt.position.map((r=>ei(r))).join(",")),e.endAt&&(t+="|ub:",t+=e.endAt.inclusive?"a:":"b:",t+=e.endAt.position.map((r=>ei(r))).join(",")),e.Te=t}return e.Te}function na(n,e){if(n.limit!==e.limit||n.orderBy.length!==e.orderBy.length)return!1;for(let t=0;t<n.orderBy.length;t++)if(!Pb(n.orderBy[t],e.orderBy[t]))return!1;if(n.filters.length!==e.filters.length)return!1;for(let t=0;t<n.filters.length;t++)if(!f_(n.filters[t],e.filters[t]))return!1;return n.collectionGroup===e.collectionGroup&&!!n.path.isEqual(e.path)&&!!im(n.startAt,e.startAt)&&im(n.endAt,e.endAt)}function pc(n){return B.isDocumentKey(n.path)&&n.collectionGroup===null&&n.filters.length===0}function gc(n,e){return n.filters.filter((t=>t instanceof ue&&t.field.isEqual(e)))}function om(n,e,t){let r=Ha,s=!0;for(const i of gc(n,e)){let o=Ha,a=!0;switch(i.op){case"<":case"<=":o=Sb(i.value);break;case"==":case"in":case">=":o=i.value;break;case">":o=i.value,a=!1;break;case"!=":case"not-in":o=Ha}nm({value:r,inclusive:s},{value:o,inclusive:a})<0&&(r=o,s=a)}if(t!==null){for(let i=0;i<n.orderBy.length;++i)if(n.orderBy[i].field.isEqual(e)){const o=t.position[i];nm({value:r,inclusive:s},{value:o,inclusive:t.inclusive})<0&&(r=o,s=t.inclusive);break}}return{value:r,inclusive:s}}function am(n,e,t){let r=Xn,s=!0;for(const i of gc(n,e)){let o=Xn,a=!0;switch(i.op){case">=":case">":o=Rb(i.value),a=!1;break;case"==":case"in":case"<=":o=i.value;break;case"<":o=i.value,a=!1;break;case"!=":case"not-in":o=Xn}rm({value:r,inclusive:s},{value:o,inclusive:a})>0&&(r=o,s=a)}if(t!==null){for(let i=0;i<n.orderBy.length;++i)if(n.orderBy[i].field.isEqual(e)){const o=t.position[i];rm({value:r,inclusive:s},{value:o,inclusive:t.inclusive})>0&&(r=o,s=t.inclusive);break}}return{value:r,inclusive:s}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class bn{constructor(e,t=null,r=[],s=[],i=null,o="F",a=null,u=null){this.path=e,this.collectionGroup=t,this.explicitOrderBy=r,this.filters=s,this.limit=i,this.limitType=o,this.startAt=a,this.endAt=u,this.Ie=null,this.Ee=null,this.Re=null,this.startAt,this.endAt}}function y_(n,e,t,r,s,i,o,a){return new bn(n,e,t,r,s,i,o,a)}function gi(n){return new bn(n)}function cm(n){return n.filters.length===0&&n.limit===null&&n.startAt==null&&n.endAt==null&&(n.explicitOrderBy.length===0||n.explicitOrderBy.length===1&&n.explicitOrderBy[0].field.isKeyField())}function Mb(n){return B.isDocumentKey(n.path)&&n.collectionGroup===null&&n.filters.length===0}function hh(n){return n.collectionGroup!==null}function Bs(n){const e=F(n);if(e.Ie===null){e.Ie=[];const t=new Set;for(const i of e.explicitOrderBy)e.Ie.push(i),t.add(i.field.canonicalString());const r=e.explicitOrderBy.length>0?e.explicitOrderBy[e.explicitOrderBy.length-1].dir:"asc";(function(o){let a=new Ie(Ve.comparator);return o.filters.forEach((u=>{u.getFlattenedFilters().forEach((l=>{l.isInequality()&&(a=a.add(l.field))}))})),a})(e).forEach((i=>{t.has(i.canonicalString())||i.isKeyField()||e.Ie.push(new Uo(i,r))})),t.has(Ve.keyField().canonicalString())||e.Ie.push(new Uo(Ve.keyField(),r))}return e.Ie}function dt(n){const e=F(n);return e.Ee||(e.Ee=w_(e,Bs(n))),e.Ee}function I_(n){const e=F(n);return e.Re||(e.Re=w_(e,n.explicitOrderBy)),e.Re}function w_(n,e){if(n.limitType==="F")return Il(n.path,n.collectionGroup,e,n.filters,n.limit,n.startAt,n.endAt);{e=e.map((s=>{const i=s.dir==="desc"?"asc":"desc";return new Uo(s.field,i)}));const t=n.endAt?new hr(n.endAt.position,n.endAt.inclusive):null,r=n.startAt?new hr(n.startAt.position,n.startAt.inclusive):null;return Il(n.path,n.collectionGroup,e,n.filters,n.limit,t,r)}}function wl(n,e){const t=n.filters.concat([e]);return new bn(n.path,n.collectionGroup,n.explicitOrderBy.slice(),t,n.limit,n.limitType,n.startAt,n.endAt)}function Lb(n,e){const t=n.explicitOrderBy.concat([e]);return new bn(n.path,n.collectionGroup,t,n.filters.slice(),n.limit,n.limitType,n.startAt,n.endAt)}function _c(n,e,t){return new bn(n.path,n.collectionGroup,n.explicitOrderBy.slice(),n.filters.slice(),e,t,n.startAt,n.endAt)}function Bb(n,e){return new bn(n.path,n.collectionGroup,n.explicitOrderBy.slice(),n.filters.slice(),n.limit,n.limitType,e,n.endAt)}function Fb(n,e){return new bn(n.path,n.collectionGroup,n.explicitOrderBy.slice(),n.filters.slice(),n.limit,n.limitType,n.startAt,e)}function ra(n,e){return na(dt(n),dt(e))&&n.limitType===e.limitType}function E_(n){return`${Yr(dt(n))}|lt:${n.limitType}`}function Ns(n){return`Query(target=${(function(t){let r=t.path.canonicalString();return t.collectionGroup!==null&&(r+=" collectionGroup="+t.collectionGroup),t.filters.length>0&&(r+=`, filters: [${t.filters.map((s=>p_(s))).join(", ")}]`),ea(t.limit)||(r+=", limit: "+t.limit),t.orderBy.length>0&&(r+=`, orderBy: [${t.orderBy.map((s=>(function(o){return`${o.field.canonicalString()} (${o.dir})`})(s))).join(", ")}]`),t.startAt&&(r+=", startAt: ",r+=t.startAt.inclusive?"b:":"a:",r+=t.startAt.position.map((s=>ei(s))).join(",")),t.endAt&&(r+=", endAt: ",r+=t.endAt.inclusive?"a:":"b:",r+=t.endAt.position.map((s=>ei(s))).join(",")),`Target(${r})`})(dt(n))}; limitType=${n.limitType})`}function sa(n,e){return e.isFoundDocument()&&(function(r,s){const i=s.key.path;return r.collectionGroup!==null?s.key.hasCollectionId(r.collectionGroup)&&r.path.isPrefixOf(i):B.isDocumentKey(r.path)?r.path.isEqual(i):r.path.isImmediateParentOf(i)})(n,e)&&(function(r,s){for(const i of Bs(r))if(!i.field.isKeyField()&&s.data.field(i.field)===null)return!1;return!0})(n,e)&&(function(r,s){for(const i of r.filters)if(!i.matches(s))return!1;return!0})(n,e)&&(function(r,s){return!(r.startAt&&!(function(o,a,u){const l=sm(o,a,u);return o.inclusive?l<=0:l<0})(r.startAt,Bs(r),s)||r.endAt&&!(function(o,a,u){const l=sm(o,a,u);return o.inclusive?l>=0:l>0})(r.endAt,Bs(r),s))})(n,e)}function T_(n){return n.collectionGroup||(n.path.length%2==1?n.path.lastSegment():n.path.get(n.path.length-2))}function A_(n){return(e,t)=>{let r=!1;for(const s of Bs(n)){const i=Ub(s,e,t);if(i!==0)return i;r=r||s.field.isKeyField()}return 0}}function Ub(n,e,t){const r=n.field.isKeyField()?B.comparator(e.key,t.key):(function(i,o,a){const u=o.data.field(i),l=a.data.field(i);return u!==null&&l!==null?lr(u,l):j(42886)})(n.field,e,t);switch(n.dir){case"asc":return r;case"desc":return-1*r;default:return j(19790,{direction:n.dir})}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Sn{constructor(e,t){this.mapKeyFn=e,this.equalsFn=t,this.inner={},this.innerSize=0}get(e){const t=this.mapKeyFn(e),r=this.inner[t];if(r!==void 0){for(const[s,i]of r)if(this.equalsFn(s,e))return i}}has(e){return this.get(e)!==void 0}set(e,t){const r=this.mapKeyFn(e),s=this.inner[r];if(s===void 0)return this.inner[r]=[[e,t]],void this.innerSize++;for(let i=0;i<s.length;i++)if(this.equalsFn(s[i][0],e))return void(s[i]=[e,t]);s.push([e,t]),this.innerSize++}delete(e){const t=this.mapKeyFn(e),r=this.inner[t];if(r===void 0)return!1;for(let s=0;s<r.length;s++)if(this.equalsFn(r[s][0],e))return r.length===1?delete this.inner[t]:r.splice(s,1),this.innerSize--,!0;return!1}forEach(e){wr(this.inner,((t,r)=>{for(const[s,i]of r)e(s,i)}))}isEmpty(){return e_(this.inner)}size(){return this.innerSize}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const $b=new ve(B.comparator);function yt(){return $b}const v_=new ve(B.comparator);function ho(...n){let e=v_;for(const t of n)e=e.insert(t.key,t);return e}function b_(n){let e=v_;return n.forEach(((t,r)=>e=e.insert(t,r.overlayedDocument))),e}function Qt(){return Eo()}function S_(){return Eo()}function Eo(){return new Sn((n=>n.toString()),((n,e)=>n.isEqual(e)))}const qb=new ve(B.comparator),jb=new Ie(B.comparator);function re(...n){let e=jb;for(const t of n)e=e.add(t);return e}const Gb=new Ie(Z);function dh(){return Gb}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Kc(n,e){if(n.useProto3Json){if(isNaN(e))return{doubleValue:"NaN"};if(e===1/0)return{doubleValue:"Infinity"};if(e===-1/0)return{doubleValue:"-Infinity"}}return{doubleValue:No(e)?"-0":e}}function fh(n){return{integerValue:""+n}}function Wc(n,e){return qg(e)?fh(e):Kc(n,e)}/**
 * @license
 * Copyright 2018 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Hc{constructor(){this._=void 0}}function zb(n,e,t){return n instanceof ni?(function(s,i){const o={fields:{[r_]:{stringValue:n_},[i_]:{timestampValue:{seconds:s.seconds,nanos:s.nanoseconds}}}};return i&&jc(i)&&(i=Gc(i)),i&&(o.fields[s_]=i),{mapValue:o}})(t,e):n instanceof Xr?P_(n,e):n instanceof Zr?k_(n,e):n instanceof es?(function(s,i){const o=R_(s,i),a=yc(o)+yc(s.Ae);return Bo(o)&&Bo(s.Ae)?fh(a):Kc(s.serializer,a)})(n,e):n instanceof ri?(function(s,i){return um(s,i,Math.min)})(n,e):n instanceof si?(function(s,i){return um(s,i,Math.max)})(n,e):void 0}function Kb(n,e,t){return n instanceof Xr?P_(n,e):n instanceof Zr?k_(n,e):t}function R_(n,e){return n instanceof es?a_(e)?e:{integerValue:0}:null}class ni extends Hc{}class Xr extends Hc{constructor(e){super(),this.elements=e}}function P_(n,e){const t=C_(e);for(const r of n.elements)t.some((s=>an(s,r)))||t.push(r);return{arrayValue:{values:t}}}class Zr extends Hc{constructor(e){super(),this.elements=e}}function k_(n,e){let t=C_(e);for(const r of n.elements)t=t.filter((s=>!an(s,r)));return{arrayValue:{values:t}}}class mh extends Hc{constructor(e,t){super(),this.serializer=e,this.Ae=t}}class es extends mh{}class ri extends mh{}class si extends mh{}function um(n,e,t){if(!a_(e))return n.Ae;const r=t(yc(e),yc(n.Ae));return Bo(e)&&Bo(n.Ae)?fh(r):Kc(n.serializer,r)}function yc(n){return De(n.integerValue||n.doubleValue)}function C_(n){return Fo(n)&&n.arrayValue.values?n.arrayValue.values.slice():[]}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ls{constructor(e,t){this.field=e,this.transform=t}}function Wb(n,e){return n.field.isEqual(e.field)&&(function(r,s){return r instanceof Xr&&s instanceof Xr||r instanceof Zr&&s instanceof Zr?zs(r.elements,s.elements,an):r instanceof es&&s instanceof es||r instanceof ri&&s instanceof ri||r instanceof si&&s instanceof si?an(r.Ae,s.Ae):r instanceof ni&&s instanceof ni})(n.transform,e.transform)}class Hb{constructor(e,t){this.version=e,this.transformResults=t}}class Oe{constructor(e,t){this.updateTime=e,this.exists=t}static none(){return new Oe}static exists(e){return new Oe(void 0,e)}static updateTime(e){return new Oe(e)}get isNone(){return this.updateTime===void 0&&this.exists===void 0}isEqual(e){return this.exists===e.exists&&(this.updateTime?!!e.updateTime&&this.updateTime.isEqual(e.updateTime):!e.updateTime)}}function Ya(n,e){return n.updateTime!==void 0?e.isFoundDocument()&&e.version.isEqual(n.updateTime):n.exists===void 0||n.exists===e.isFoundDocument()}class Qc{}function N_(n,e){if(!n.hasLocalMutations||e&&e.fields.length===0)return null;if(e===null)return n.isNoDocument()?new yi(n.key,Oe.none()):new _i(n.key,n.data,Oe.none());{const t=n.data,r=rt.empty();let s=new Ie(Ve.comparator);for(let i of e.fields)if(!s.has(i)){let o=t.field(i);o===null&&i.length>1&&(i=i.popLast(),o=t.field(i)),o===null?r.delete(i):r.set(i,o),s=s.add(i)}return new Rn(n.key,r,new _t(s.toArray()),Oe.none())}}function Qb(n,e,t){n instanceof _i?(function(s,i,o){const a=s.value.clone(),u=hm(s.fieldTransforms,i,o.transformResults);a.setAll(u),i.convertToFoundDocument(o.version,a).setHasCommittedMutations()})(n,e,t):n instanceof Rn?(function(s,i,o){if(!Ya(s.precondition,i))return void i.convertToUnknownDocument(o.version);const a=hm(s.fieldTransforms,i,o.transformResults),u=i.data;u.setAll(D_(s)),u.setAll(a),i.convertToFoundDocument(o.version,u).setHasCommittedMutations()})(n,e,t):(function(s,i,o){i.convertToNoDocument(o.version).setHasCommittedMutations()})(0,e,t)}function To(n,e,t,r){return n instanceof _i?(function(i,o,a,u){if(!Ya(i.precondition,o))return a;const l=i.value.clone(),h=dm(i.fieldTransforms,u,o);return l.setAll(h),o.convertToFoundDocument(o.version,l).setHasLocalMutations(),null})(n,e,t,r):n instanceof Rn?(function(i,o,a,u){if(!Ya(i.precondition,o))return a;const l=dm(i.fieldTransforms,u,o),h=o.data;return h.setAll(D_(i)),h.setAll(l),o.convertToFoundDocument(o.version,h).setHasLocalMutations(),a===null?null:a.unionWith(i.fieldMask.fields).unionWith(i.fieldTransforms.map((f=>f.field)))})(n,e,t,r):(function(i,o,a){return Ya(i.precondition,o)?(o.convertToNoDocument(o.version).setHasLocalMutations(),null):a})(n,e,t)}function Jb(n,e){let t=null;for(const r of n.fieldTransforms){const s=e.data.field(r.field),i=R_(r.transform,s||null);i!=null&&(t===null&&(t=rt.empty()),t.set(r.field,i))}return t||null}function lm(n,e){return n.type===e.type&&!!n.key.isEqual(e.key)&&!!n.precondition.isEqual(e.precondition)&&!!(function(r,s){return r===void 0&&s===void 0||!(!r||!s)&&zs(r,s,((i,o)=>Wb(i,o)))})(n.fieldTransforms,e.fieldTransforms)&&(n.type===0?n.value.isEqual(e.value):n.type!==1||n.data.isEqual(e.data)&&n.fieldMask.isEqual(e.fieldMask))}class _i extends Qc{constructor(e,t,r,s=[]){super(),this.key=e,this.value=t,this.precondition=r,this.fieldTransforms=s,this.type=0}getFieldMask(){return null}}class Rn extends Qc{constructor(e,t,r,s,i=[]){super(),this.key=e,this.data=t,this.fieldMask=r,this.precondition=s,this.fieldTransforms=i,this.type=1}getFieldMask(){return this.fieldMask}}function D_(n){const e=new Map;return n.fieldMask.fields.forEach((t=>{if(!t.isEmpty()){const r=n.data.field(t);e.set(t,r)}})),e}function hm(n,e,t){const r=new Map;K(n.length===t.length,32656,{Ve:t.length,de:n.length});for(let s=0;s<t.length;s++){const i=n[s],o=i.transform,a=e.data.field(i.field);r.set(i.field,Kb(o,a,t[s]))}return r}function dm(n,e,t){const r=new Map;for(const s of n){const i=s.transform,o=t.data.field(s.field);r.set(s.field,zb(i,o,e))}return r}class yi extends Qc{constructor(e,t){super(),this.key=e,this.precondition=t,this.type=2,this.fieldTransforms=[]}getFieldMask(){return null}}class ph extends Qc{constructor(e,t){super(),this.key=e,this.precondition=t,this.type=3,this.fieldTransforms=[]}getFieldMask(){return null}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class gh{constructor(e,t,r,s){this.batchId=e,this.localWriteTime=t,this.baseMutations=r,this.mutations=s}applyToRemoteDocument(e,t){const r=t.mutationResults;for(let s=0;s<this.mutations.length;s++){const i=this.mutations[s];i.key.isEqual(e.key)&&Qb(i,e,r[s])}}applyToLocalView(e,t){for(const r of this.baseMutations)r.key.isEqual(e.key)&&(t=To(r,e,t,this.localWriteTime));for(const r of this.mutations)r.key.isEqual(e.key)&&(t=To(r,e,t,this.localWriteTime));return t}applyToLocalDocumentSet(e,t){const r=S_();return this.mutations.forEach((s=>{const i=e.get(s.key),o=i.overlayedDocument;let a=this.applyToLocalView(o,i.mutatedFields);a=t.has(s.key)?null:a;const u=N_(o,a);u!==null&&r.set(s.key,u),o.isValidDocument()||o.convertToNoDocument(J.min())})),r}keys(){return this.mutations.reduce(((e,t)=>e.add(t.key)),re())}isEqual(e){return this.batchId===e.batchId&&zs(this.mutations,e.mutations,((t,r)=>lm(t,r)))&&zs(this.baseMutations,e.baseMutations,((t,r)=>lm(t,r)))}}class _h{constructor(e,t,r,s){this.batch=e,this.commitVersion=t,this.mutationResults=r,this.docVersions=s}static from(e,t,r){K(e.mutations.length===r.length,58842,{me:e.mutations.length,fe:r.length});let s=(function(){return qb})();const i=e.mutations;for(let o=0;o<i.length;o++)s=s.insert(i[o].key,r[o].version);return new _h(e,t,r,s)}}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class yh{constructor(e,t){this.largestBatchId=e,this.mutation=t}getKey(){return this.mutation.key}isEqual(e){return e!==null&&this.mutation===e.mutation}toString(){return`Overlay{
      largestBatchId: ${this.largestBatchId},
      mutation: ${this.mutation.toString()}
    }`}}/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class V_{constructor(e,t,r){this.alias=e,this.aggregateType=t,this.fieldPath=r}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Yb{constructor(e,t){this.count=e,this.unchangedNames=t}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var ze,le;function O_(n){switch(n){case k.OK:return j(64938);case k.CANCELLED:case k.UNKNOWN:case k.DEADLINE_EXCEEDED:case k.RESOURCE_EXHAUSTED:case k.INTERNAL:case k.UNAVAILABLE:case k.UNAUTHENTICATED:return!1;case k.INVALID_ARGUMENT:case k.NOT_FOUND:case k.ALREADY_EXISTS:case k.PERMISSION_DENIED:case k.FAILED_PRECONDITION:case k.ABORTED:case k.OUT_OF_RANGE:case k.UNIMPLEMENTED:case k.DATA_LOSS:return!0;default:return j(15467,{code:n})}}function x_(n){if(n===void 0)return qe("GRPC error has no .code"),k.UNKNOWN;switch(n){case ze.OK:return k.OK;case ze.CANCELLED:return k.CANCELLED;case ze.UNKNOWN:return k.UNKNOWN;case ze.DEADLINE_EXCEEDED:return k.DEADLINE_EXCEEDED;case ze.RESOURCE_EXHAUSTED:return k.RESOURCE_EXHAUSTED;case ze.INTERNAL:return k.INTERNAL;case ze.UNAVAILABLE:return k.UNAVAILABLE;case ze.UNAUTHENTICATED:return k.UNAUTHENTICATED;case ze.INVALID_ARGUMENT:return k.INVALID_ARGUMENT;case ze.NOT_FOUND:return k.NOT_FOUND;case ze.ALREADY_EXISTS:return k.ALREADY_EXISTS;case ze.PERMISSION_DENIED:return k.PERMISSION_DENIED;case ze.FAILED_PRECONDITION:return k.FAILED_PRECONDITION;case ze.ABORTED:return k.ABORTED;case ze.OUT_OF_RANGE:return k.OUT_OF_RANGE;case ze.UNIMPLEMENTED:return k.UNIMPLEMENTED;case ze.DATA_LOSS:return k.DATA_LOSS;default:return j(39323,{code:n})}}(le=ze||(ze={}))[le.OK=0]="OK",le[le.CANCELLED=1]="CANCELLED",le[le.UNKNOWN=2]="UNKNOWN",le[le.INVALID_ARGUMENT=3]="INVALID_ARGUMENT",le[le.DEADLINE_EXCEEDED=4]="DEADLINE_EXCEEDED",le[le.NOT_FOUND=5]="NOT_FOUND",le[le.ALREADY_EXISTS=6]="ALREADY_EXISTS",le[le.PERMISSION_DENIED=7]="PERMISSION_DENIED",le[le.UNAUTHENTICATED=16]="UNAUTHENTICATED",le[le.RESOURCE_EXHAUSTED=8]="RESOURCE_EXHAUSTED",le[le.FAILED_PRECONDITION=9]="FAILED_PRECONDITION",le[le.ABORTED=10]="ABORTED",le[le.OUT_OF_RANGE=11]="OUT_OF_RANGE",le[le.UNIMPLEMENTED=12]="UNIMPLEMENTED",le[le.INTERNAL=13]="INTERNAL",le[le.UNAVAILABLE=14]="UNAVAILABLE",le[le.DATA_LOSS=15]="DATA_LOSS";/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */let Ao=null;function Xb(n){if(Ao)throw new Error("a TestingHooksSpi instance is already set");Ao=n}/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function M_(){return new TextEncoder}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Zb=new ir([4294967295,4294967295],0);function fm(n){const e=M_().encode(n),t=new Sg;return t.update(e),new Uint8Array(t.digest())}function mm(n){const e=new DataView(n.buffer),t=e.getUint32(0,!0),r=e.getUint32(4,!0),s=e.getUint32(8,!0),i=e.getUint32(12,!0);return[new ir([t,r],0),new ir([s,i],0)]}class Ih{constructor(e,t,r){if(this.bitmap=e,this.padding=t,this.hashCount=r,t<0||t>=8)throw new fo(`Invalid padding: ${t}`);if(r<0)throw new fo(`Invalid hash count: ${r}`);if(e.length>0&&this.hashCount===0)throw new fo(`Invalid hash count: ${r}`);if(e.length===0&&t!==0)throw new fo(`Invalid padding when bitmap length is 0: ${t}`);this.ge=8*e.length-t,this.pe=ir.fromNumber(this.ge)}ye(e,t,r){let s=e.add(t.multiply(ir.fromNumber(r)));return s.compare(Zb)===1&&(s=new ir([s.getBits(0),s.getBits(1)],0)),s.modulo(this.pe).toNumber()}we(e){return!!(this.bitmap[Math.floor(e/8)]&1<<e%8)}mightContain(e){if(this.ge===0)return!1;const t=fm(e),[r,s]=mm(t);for(let i=0;i<this.hashCount;i++){const o=this.ye(r,s,i);if(!this.we(o))return!1}return!0}static create(e,t,r){const s=e%8==0?0:8-e%8,i=new Uint8Array(Math.ceil(e/8)),o=new Ih(i,s,t);return r.forEach((a=>o.insert(a))),o}insert(e){if(this.ge===0)return;const t=fm(e),[r,s]=mm(t);for(let i=0;i<this.hashCount;i++){const o=this.ye(r,s,i);this.Se(o)}}Se(e){const t=Math.floor(e/8),r=e%8;this.bitmap[t]|=1<<r}}class fo extends Error{constructor(){super(...arguments),this.name="BloomFilterError"}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Ii{constructor(e,t,r,s,i){this.snapshotVersion=e,this.targetChanges=t,this.targetMismatches=r,this.documentUpdates=s,this.resolvedLimboDocuments=i}static createSynthesizedRemoteEventForCurrentChange(e,t,r){const s=new Map;return s.set(e,ia.createSynthesizedTargetChangeForCurrentChange(e,t,r)),new Ii(J.min(),s,new ve(Z),yt(),re())}}class ia{constructor(e,t,r,s,i){this.resumeToken=e,this.current=t,this.addedDocuments=r,this.modifiedDocuments=s,this.removedDocuments=i}static createSynthesizedTargetChangeForCurrentChange(e,t,r){return new ia(r,t,re(),re(),re())}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Xa{constructor(e,t,r,s){this.be=e,this.removedTargetIds=t,this.key=r,this.De=s}}class L_{constructor(e,t){this.targetId=e,this.Ce=t}}class B_{constructor(e,t,r=Fe.EMPTY_BYTE_STRING,s=null){this.state=e,this.targetIds=t,this.resumeToken=r,this.cause=s}}class pm{constructor(e){this.targetId=e,this.ve=0,this.Fe=gm(),this.Me=Fe.EMPTY_BYTE_STRING,this.xe=!1,this.Oe=!0}get current(){return this.xe}get resumeToken(){return this.Me}get Ne(){return this.ve!==0}get Be(){return this.Oe}Le(e){e.approximateByteSize()>0&&(this.Oe=!0,this.Me=e)}ke(){let e=re(),t=re(),r=re();return this.Fe.forEach(((s,i)=>{switch(i){case 0:e=e.add(s);break;case 2:t=t.add(s);break;case 1:r=r.add(s);break;default:j(38017,{changeType:i})}})),new ia(this.Me,this.xe,e,t,r)}qe(){this.Oe=!1,this.Fe=gm()}Ke(e,t){this.Oe=!0,this.Fe=this.Fe.insert(e,t)}Ue(e){this.Oe=!0,this.Fe=this.Fe.remove(e)}$e(){this.ve+=1}We(){this.ve-=1,K(this.ve>=0,3241,{ve:this.ve,targetId:this.targetId})}Qe(){this.Oe=!0,this.xe=!0}}const Zi="WatchChangeAggregator";class eS{constructor(e){this.Ge=e,this.ze=new Map,this.je=yt(),this.Je=Da(),this.He=Da(),this.Ze=new ve(Z)}Xe(e){for(const t of e.be)e.De&&e.De.isFoundDocument()?this.Ye(t,e.De):this.et(t,e.key,e.De);for(const t of e.removedTargetIds)this.et(t,e.key,e.De)}tt(e){this.forEachTarget(e,(t=>{const r=this.ze.get(t);if(r)switch(e.state){case 0:this.nt(t)&&r.Le(e.resumeToken);break;case 1:r.We(),r.Ne||r.qe(),r.Le(e.resumeToken);break;case 2:r.We(),r.Ne||this.removeTarget(t);break;case 3:this.nt(t)&&(r.Qe(),r.Le(e.resumeToken));break;case 4:this.nt(t)&&(this.rt(t),r.Le(e.resumeToken));break;default:j(56790,{state:e.state})}else x(Zi,`handleTargetChange received targetChange for untracked target ID (${t}) with state (${e.state})`)}))}forEachTarget(e,t){e.targetIds.length>0?e.targetIds.forEach(t):this.ze.forEach(((r,s)=>{this.nt(s)&&t(s)}))}it(e){const t=e.targetId,r=e.Ce.count,s=this.st(t);if(s){const i=s.target;if(pc(i))if(r===0){const o=new B(i.path);this.et(t,o,Ce.newNoDocument(o,J.min()))}else K(r===1,20013,{expectedCount:r});else{const o=this.ot(t);if(o!==r){const a=this._t(e),u=a?this.ut(a,e,o):1;if(u!==0){this.rt(t);const l=u===2?"TargetPurposeExistenceFilterMismatchBloom":"TargetPurposeExistenceFilterMismatch";this.Ze=this.Ze.insert(t,l)}Ao==null||Ao.o((function(h,f,p,_,w){var V,O,L;const b={localCacheCount:h,existenceFilterCount:f.count,databaseId:p.database,projectId:p.projectId},C=f.unchangedNames;return C&&(b.bloomFilter={applied:w===0,hashCount:(C==null?void 0:C.hashCount)??0,bitmapLength:((O=(V=C==null?void 0:C.bits)==null?void 0:V.bitmap)==null?void 0:O.length)??0,padding:((L=C==null?void 0:C.bits)==null?void 0:L.padding)??0,mightContain:z=>(_==null?void 0:_.mightContain(z))??!1}),b})(o,e.Ce,this.Ge.lt(),a,u))}}}}_t(e){const t=e.Ce.unchangedNames;if(!t||!t.bits)return null;const{bits:{bitmap:r="",padding:s=0},hashCount:i=0}=t;let o,a;try{o=wn(r).toUint8Array()}catch(u){if(u instanceof t_)return Rt("Decoding the base64 bloom filter in existence filter failed ("+u.message+"); ignoring the bloom filter and falling back to full re-query."),null;throw u}try{a=new Ih(o,s,i)}catch(u){return Rt(u instanceof fo?"BloomFilter error: ":"Applying bloom filter failed: ",u),null}return a.ge===0?null:a}ut(e,t,r){return t.Ce.count===r-this.ht(e,t.targetId)?0:2}ht(e,t){const r=this.Ge.getRemoteKeysForTarget(t);let s=0;return r.forEach((i=>{const o=this.Ge.lt(),a=`projects/${o.projectId}/databases/${o.database}/documents/${i.path.canonicalString()}`;e.mightContain(a)||(this.et(t,i,null),s++)})),s}Pt(e){const t=new Map;this.ze.forEach(((i,o)=>{const a=this.st(o);if(a){if(i.current&&pc(a.target)){const u=new B(a.target.path);this.Tt(u).has(o)||this.It(o,u)||this.et(o,u,Ce.newNoDocument(u,e))}i.Be&&(t.set(o,i.ke()),i.qe())}}));let r=re();this.He.forEach(((i,o)=>{let a=!0;o.forEachWhile((u=>{const l=this.st(u);return!l||l.purpose==="TargetPurposeLimboResolution"||(a=!1,!1)})),a&&(r=r.add(i))})),this.je.forEach(((i,o)=>o.setReadTime(e)));const s=new Ii(e,t,this.Ze,this.je,r);return this.je=yt(),this.Je=Da(),this.He=Da(),this.Ze=new ve(Z),s}Ye(e,t){const r=this.ze.get(e);if(!r||!this.nt(e))return void x(Zi,`addDocumentToTarget received document for unknown inactive target (${e})`);const s=this.It(e,t.key)?2:0;r.Ke(t.key,s),this.je=this.je.insert(t.key,t),this.Je=this.Je.insert(t.key,this.Tt(t.key).add(e)),this.He=this.He.insert(t.key,this.Et(t.key).add(e))}et(e,t,r){const s=this.ze.get(e);s&&this.nt(e)?(this.It(e,t)?s.Ke(t,1):s.Ue(t),this.He=this.He.insert(t,this.Et(t).delete(e)),this.He=this.He.insert(t,this.Et(t).add(e)),r&&(this.je=this.je.insert(t,r))):x(Zi,`removeDocumentFromTarget received document for unknown or inactive target (${e})`)}removeTarget(e){this.ze.delete(e)}ot(e){const t=this.ze.get(e);if(!t)return 0;const r=t.ke();return this.Ge.getRemoteKeysForTarget(e).size+r.addedDocuments.size-r.removedDocuments.size}$e(e){let t=this.ze.get(e);t||(x(Zi,`recordPendingTargetRequest set up tracking for target ID ${e}`),t=new pm(e),this.ze.set(e,t)),t.$e()}Et(e){let t=this.He.get(e);return t||(t=new Ie(Z),this.He=this.He.insert(e,t)),t}Tt(e){let t=this.Je.get(e);return t||(t=new Ie(Z),this.Je=this.Je.insert(e,t)),t}nt(e){const t=this.st(e)!==null;return t||x(Zi,"Detected inactive target",e),t}st(e){const t=this.ze.get(e);return t===void 0||t.Ne?null:this.Ge.Rt(e)}rt(e){this.ze.set(e,new pm(e)),this.Ge.getRemoteKeysForTarget(e).forEach((t=>{this.et(e,t,null)}))}It(e,t){return this.Ge.getRemoteKeysForTarget(e).has(t)}}function Da(){return new ve(B.comparator)}function gm(){return new ve(B.comparator)}const tS={asc:"ASCENDING",desc:"DESCENDING"},nS={"<":"LESS_THAN","<=":"LESS_THAN_OR_EQUAL",">":"GREATER_THAN",">=":"GREATER_THAN_OR_EQUAL","==":"EQUAL","!=":"NOT_EQUAL","array-contains":"ARRAY_CONTAINS",in:"IN","not-in":"NOT_IN","array-contains-any":"ARRAY_CONTAINS_ANY"},rS={and:"AND",or:"OR"};class sS{constructor(e,t){this.databaseId=e,this.useProto3Json=t}}function El(n,e){return n.useProto3Json||ea(e)?e:{value:e}}function ii(n,e){return n.useProto3Json?`${new Date(1e3*e.seconds).toISOString().replace(/\.\d*/,"").replace("Z","")}.${("000000000"+e.nanoseconds).slice(-9)}Z`:{seconds:""+e.seconds,nanos:e.nanoseconds}}function F_(n,e){return n.useProto3Json?e.toBase64():e.toUint8Array()}function iS(n,e){return ii(n,e.toTimestamp())}function je(n){return K(!!n,49232),J.fromTimestamp((function(t){const r=In(t);return new _e(r.seconds,r.nanos)})(n))}function wh(n,e){return Tl(n,e).canonicalString()}function Tl(n,e){const t=(function(s){return new oe(["projects",s.projectId,"databases",s.database])})(n).child("documents");return e===void 0?t:t.child(e)}function U_(n){const e=oe.fromString(n);return K(Q_(e),10190,{key:e.toString()}),e}function $o(n,e){return wh(n.databaseId,e.path)}function nn(n,e){const t=U_(e);if(t.get(1)!==n.databaseId.projectId)throw new D(k.INVALID_ARGUMENT,"Tried to deserialize key from different project: "+t.get(1)+" vs "+n.databaseId.projectId);if(t.get(3)!==n.databaseId.database)throw new D(k.INVALID_ARGUMENT,"Tried to deserialize key from different database: "+t.get(3)+" vs "+n.databaseId.database);return new B(j_(t))}function $_(n,e){return wh(n.databaseId,e)}function q_(n){const e=U_(n);return e.length===4?oe.emptyPath():j_(e)}function Al(n){return new oe(["projects",n.databaseId.projectId,"databases",n.databaseId.database]).canonicalString()}function j_(n){return K(n.length>4&&n.get(4)==="documents",29091,{key:n.toString()}),n.popFirst(5)}function _m(n,e,t){return{name:$o(n,e),fields:t.value.mapValue.fields}}function Jc(n,e,t){const r=nn(n,e.name),s=je(e.updateTime),i=e.createTime?je(e.createTime):J.min(),o=new rt({mapValue:{fields:e.fields}}),a=Ce.newFoundDocument(r,s,i,o);return t&&a.setHasCommittedMutations(),t?a.setHasCommittedMutations():a}function oS(n,e){return"found"in e?(function(r,s){K(!!s.found,43571),s.found.name,s.found.updateTime;const i=nn(r,s.found.name),o=je(s.found.updateTime),a=s.found.createTime?je(s.found.createTime):J.min(),u=new rt({mapValue:{fields:s.found.fields}});return Ce.newFoundDocument(i,o,a,u)})(n,e):"missing"in e?(function(r,s){K(!!s.missing,3894),K(!!s.readTime,22933);const i=nn(r,s.missing),o=je(s.readTime);return Ce.newNoDocument(i,o)})(n,e):j(7234,{result:e})}function aS(n,e){let t;if("targetChange"in e){e.targetChange;const r=(function(l){return l==="NO_CHANGE"?0:l==="ADD"?1:l==="REMOVE"?2:l==="CURRENT"?3:l==="RESET"?4:j(39313,{state:l})})(e.targetChange.targetChangeType||"NO_CHANGE"),s=e.targetChange.targetIds||[],i=(function(l,h){return l.useProto3Json?(K(h===void 0||typeof h=="string",58123),Fe.fromBase64String(h||"")):(K(h===void 0||h instanceof Buffer||h instanceof Uint8Array,16193),Fe.fromUint8Array(h||new Uint8Array))})(n,e.targetChange.resumeToken),o=e.targetChange.cause,a=o&&(function(l){const h=l.code===void 0?k.UNKNOWN:x_(l.code);return new D(h,l.message||"")})(o);t=new B_(r,s,i,a||null)}else if("documentChange"in e){e.documentChange;const r=e.documentChange;r.document,r.document.name,r.document.updateTime;const s=nn(n,r.document.name),i=je(r.document.updateTime),o=r.document.createTime?je(r.document.createTime):J.min(),a=new rt({mapValue:{fields:r.document.fields}}),u=Ce.newFoundDocument(s,i,o,a),l=r.targetIds||[],h=r.removedTargetIds||[];t=new Xa(l,h,u.key,u)}else if("documentDelete"in e){e.documentDelete;const r=e.documentDelete;r.document;const s=nn(n,r.document),i=r.readTime?je(r.readTime):J.min(),o=Ce.newNoDocument(s,i),a=r.removedTargetIds||[];t=new Xa([],a,o.key,o)}else if("documentRemove"in e){e.documentRemove;const r=e.documentRemove;r.document;const s=nn(n,r.document),i=r.removedTargetIds||[];t=new Xa([],i,s,null)}else{if(!("filter"in e))return j(11601,{At:e});{e.filter;const r=e.filter;r.targetId;const{count:s=0,unchangedNames:i}=r,o=new Yb(s,i),a=r.targetId;t=new L_(a,o)}}return t}function qo(n,e){let t;if(e instanceof _i)t={update:_m(n,e.key,e.value)};else if(e instanceof yi)t={delete:$o(n,e.key)};else if(e instanceof Rn)t={update:_m(n,e.key,e.data),updateMask:fS(e.fieldMask)};else{if(!(e instanceof ph))return j(16599,{Vt:e.type});t={verify:$o(n,e.key)}}return e.fieldTransforms.length>0&&(t.updateTransforms=e.fieldTransforms.map((r=>(function(i,o){const a=o.transform;if(a instanceof ni)return{fieldPath:o.field.canonicalString(),setToServerValue:"REQUEST_TIME"};if(a instanceof Xr)return{fieldPath:o.field.canonicalString(),appendMissingElements:{values:a.elements}};if(a instanceof Zr)return{fieldPath:o.field.canonicalString(),removeAllFromArray:{values:a.elements}};if(a instanceof es)return{fieldPath:o.field.canonicalString(),increment:a.Ae};if(a instanceof ri)return{fieldPath:o.field.canonicalString(),minimum:a.Ae};if(a instanceof si)return{fieldPath:o.field.canonicalString(),maximum:a.Ae};throw j(20930,{transform:o.transform})})(0,r)))),e.precondition.isNone||(t.currentDocument=(function(s,i){return i.updateTime!==void 0?{updateTime:iS(s,i.updateTime)}:i.exists!==void 0?{exists:i.exists}:j(27497)})(n,e.precondition)),t}function vl(n,e){const t=e.currentDocument?(function(i){return i.updateTime!==void 0?Oe.updateTime(je(i.updateTime)):i.exists!==void 0?Oe.exists(i.exists):Oe.none()})(e.currentDocument):Oe.none(),r=e.updateTransforms?e.updateTransforms.map((s=>(function(o,a){let u=null;if("setToServerValue"in a)K(a.setToServerValue==="REQUEST_TIME",16630,{proto:a}),u=new ni;else if("appendMissingElements"in a){const h=a.appendMissingElements.values||[];u=new Xr(h)}else if("removeAllFromArray"in a){const h=a.removeAllFromArray.values||[];u=new Zr(h)}else"increment"in a?u=new es(o,a.increment):"minimum"in a?u=new ri(o,a.minimum):"maximum"in a?u=new si(o,a.maximum):j(16584,{proto:a});const l=Ve.fromServerFormat(a.fieldPath);return new ls(l,u)})(n,s))):[];if(e.update){e.update.name;const s=nn(n,e.update.name),i=new rt({mapValue:{fields:e.update.fields}});if(e.updateMask){const o=(function(u){const l=u.fieldPaths||[];return new _t(l.map((h=>Ve.fromServerFormat(h))))})(e.updateMask);return new Rn(s,i,o,t,r)}return new _i(s,i,t,r)}if(e.delete){const s=nn(n,e.delete);return new yi(s,t)}if(e.verify){const s=nn(n,e.verify);return new ph(s,t)}return j(1463,{proto:e})}function cS(n,e){return n&&n.length>0?(K(e!==void 0,14353),n.map((t=>(function(s,i){let o=s.updateTime?je(s.updateTime):je(i);return o.isEqual(J.min())&&(o=je(i)),new Hb(o,s.transformResults||[])})(t,e)))):[]}function G_(n,e){return{documents:[$_(n,e.path)]}}function Yc(n,e){const t={structuredQuery:{}},r=e.path;let s;e.collectionGroup!==null?(s=r,t.structuredQuery.from=[{collectionId:e.collectionGroup,allDescendants:!0}]):(s=r.popLast(),t.structuredQuery.from=[{collectionId:r.lastSegment()}]),t.parent=$_(n,s);const i=(function(l){if(l.length!==0)return H_(ye.create(l,"and"))})(e.filters);i&&(t.structuredQuery.where=i);const o=(function(l){if(l.length!==0)return l.map((h=>(function(p){return{field:Qn(p.field),direction:lS(p.dir)}})(h)))})(e.orderBy);o&&(t.structuredQuery.orderBy=o);const a=El(n,e.limit);return a!==null&&(t.structuredQuery.limit=a),e.startAt&&(t.structuredQuery.startAt=(function(l){return{before:l.inclusive,values:l.position}})(e.startAt)),e.endAt&&(t.structuredQuery.endAt=(function(l){return{before:!l.inclusive,values:l.position}})(e.endAt)),{dt:t,parent:s}}function z_(n,e,t,r){const{dt:s,parent:i}=Yc(n,e),o={},a=[];let u=0;return t.forEach((l=>{const h=r?l.alias:"aggregate_"+u++;o[h]=l.alias,l.aggregateType==="count"?a.push({alias:h,count:{}}):l.aggregateType==="avg"?a.push({alias:h,avg:{field:Qn(l.fieldPath)}}):l.aggregateType==="sum"&&a.push({alias:h,sum:{field:Qn(l.fieldPath)}})})),{request:{structuredAggregationQuery:{aggregations:a,structuredQuery:s.structuredQuery},parent:s.parent},ft:o,parent:i}}function K_(n){let e=q_(n.parent);const t=n.structuredQuery,r=t.from?t.from.length:0;let s=null;if(r>0){K(r===1,65062);const h=t.from[0];h.allDescendants?s=h.collectionId:e=e.child(h.collectionId)}let i=[];t.where&&(i=(function(f){const p=W_(f);return p instanceof ye&&lh(p)?p.getFilters():[p]})(t.where));let o=[];t.orderBy&&(o=(function(f){return f.map((p=>(function(w){return new Uo(Ds(w.field),(function(C){switch(C){case"ASCENDING":return"asc";case"DESCENDING":return"desc";default:return}})(w.direction))})(p)))})(t.orderBy));let a=null;t.limit&&(a=(function(f){let p;return p=typeof f=="object"?f.value:f,ea(p)?null:p})(t.limit));let u=null;t.startAt&&(u=(function(f){const p=!!f.before,_=f.values||[];return new hr(_,p)})(t.startAt));let l=null;return t.endAt&&(l=(function(f){const p=!f.before,_=f.values||[];return new hr(_,p)})(t.endAt)),y_(e,s,o,i,a,"F",u,l)}function uS(n,e){const t=(function(s){switch(s){case"TargetPurposeListen":return null;case"TargetPurposeExistenceFilterMismatch":return"existence-filter-mismatch";case"TargetPurposeExistenceFilterMismatchBloom":return"existence-filter-mismatch-bloom";case"TargetPurposeLimboResolution":return"limbo-document";default:return j(28987,{purpose:s})}})(e.purpose);return t==null?null:{"goog-listen-tags":t}}function W_(n){return n.unaryFilter!==void 0?(function(t){switch(t.unaryFilter.op){case"IS_NAN":const r=Ds(t.unaryFilter.field);return ue.create(r,"==",{doubleValue:NaN});case"IS_NULL":const s=Ds(t.unaryFilter.field);return ue.create(s,"==",{nullValue:"NULL_VALUE"});case"IS_NOT_NAN":const i=Ds(t.unaryFilter.field);return ue.create(i,"!=",{doubleValue:NaN});case"IS_NOT_NULL":const o=Ds(t.unaryFilter.field);return ue.create(o,"!=",{nullValue:"NULL_VALUE"});case"OPERATOR_UNSPECIFIED":return j(61313);default:return j(60726)}})(n):n.fieldFilter!==void 0?(function(t){return ue.create(Ds(t.fieldFilter.field),(function(s){switch(s){case"EQUAL":return"==";case"NOT_EQUAL":return"!=";case"GREATER_THAN":return">";case"GREATER_THAN_OR_EQUAL":return">=";case"LESS_THAN":return"<";case"LESS_THAN_OR_EQUAL":return"<=";case"ARRAY_CONTAINS":return"array-contains";case"IN":return"in";case"NOT_IN":return"not-in";case"ARRAY_CONTAINS_ANY":return"array-contains-any";case"OPERATOR_UNSPECIFIED":return j(58110);default:return j(50506)}})(t.fieldFilter.op),t.fieldFilter.value)})(n):n.compositeFilter!==void 0?(function(t){return ye.create(t.compositeFilter.filters.map((r=>W_(r))),(function(s){switch(s){case"AND":return"and";case"OR":return"or";default:return j(1026)}})(t.compositeFilter.op))})(n):j(30097,{filter:n})}function lS(n){return tS[n]}function hS(n){return nS[n]}function dS(n){return rS[n]}function Qn(n){return{fieldPath:n.canonicalString()}}function Ds(n){return Ve.fromServerFormat(n.fieldPath)}function H_(n){return n instanceof ue?(function(t){if(t.op==="=="){if(tm(t.value))return{unaryFilter:{field:Qn(t.field),op:"IS_NAN"}};if(em(t.value))return{unaryFilter:{field:Qn(t.field),op:"IS_NULL"}}}else if(t.op==="!="){if(tm(t.value))return{unaryFilter:{field:Qn(t.field),op:"IS_NOT_NAN"}};if(em(t.value))return{unaryFilter:{field:Qn(t.field),op:"IS_NOT_NULL"}}}return{fieldFilter:{field:Qn(t.field),op:hS(t.op),value:t.value}}})(n):n instanceof ye?(function(t){const r=t.getFilters().map((s=>H_(s)));return r.length===1?r[0]:{compositeFilter:{op:dS(t.op),filters:r}}})(n):j(54877,{filter:n})}function fS(n){const e=[];return n.fields.forEach((t=>e.push(t.canonicalString()))),{fieldPaths:e}}function Q_(n){return n.length>=4&&n.get(0)==="projects"&&n.get(2)==="databases"}function J_(n){return!!n&&typeof n._toProto=="function"&&n._protoValueType==="ProtoValue"}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Jt{constructor(e,t,r,s,i=J.min(),o=J.min(),a=Fe.EMPTY_BYTE_STRING,u=null){this.target=e,this.targetId=t,this.purpose=r,this.sequenceNumber=s,this.snapshotVersion=i,this.lastLimboFreeSnapshotVersion=o,this.resumeToken=a,this.expectedCount=u}withSequenceNumber(e){return new Jt(this.target,this.targetId,this.purpose,e,this.snapshotVersion,this.lastLimboFreeSnapshotVersion,this.resumeToken,this.expectedCount)}withResumeToken(e,t){return new Jt(this.target,this.targetId,this.purpose,this.sequenceNumber,t,this.lastLimboFreeSnapshotVersion,e,null)}withExpectedCount(e){return new Jt(this.target,this.targetId,this.purpose,this.sequenceNumber,this.snapshotVersion,this.lastLimboFreeSnapshotVersion,this.resumeToken,e)}withLastLimboFreeSnapshotVersion(e){return new Jt(this.target,this.targetId,this.purpose,this.sequenceNumber,this.snapshotVersion,e,this.resumeToken,this.expectedCount)}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Y_{constructor(e){this.gt=e}}function mS(n,e){let t;if(e.document)t=Jc(n.gt,e.document,!!e.hasCommittedMutations);else if(e.noDocument){const r=B.fromSegments(e.noDocument.path),s=ns(e.noDocument.readTime);t=Ce.newNoDocument(r,s),e.hasCommittedMutations&&t.setHasCommittedMutations()}else{if(!e.unknownDocument)return j(56709);{const r=B.fromSegments(e.unknownDocument.path),s=ns(e.unknownDocument.version);t=Ce.newUnknownDocument(r,s)}}return e.readTime&&t.setReadTime((function(s){const i=new _e(s[0],s[1]);return J.fromTimestamp(i)})(e.readTime)),t}function ym(n,e){const t=e.key,r={prefixPath:t.getCollectionPath().popLast().toArray(),collectionGroup:t.collectionGroup,documentId:t.path.lastSegment(),readTime:Ic(e.readTime),hasCommittedMutations:e.hasCommittedMutations};if(e.isFoundDocument())r.document=(function(i,o){return{name:$o(i,o.key),fields:o.data.value.mapValue.fields,updateTime:ii(i,o.version.toTimestamp()),createTime:ii(i,o.createTime.toTimestamp())}})(n.gt,e);else if(e.isNoDocument())r.noDocument={path:t.path.toArray(),readTime:ts(e.version)};else{if(!e.isUnknownDocument())return j(57904,{document:e});r.unknownDocument={path:t.path.toArray(),version:ts(e.version)}}return r}function Ic(n){const e=n.toTimestamp();return[e.seconds,e.nanoseconds]}function ts(n){const e=n.toTimestamp();return{seconds:e.seconds,nanoseconds:e.nanoseconds}}function ns(n){const e=new _e(n.seconds,n.nanoseconds);return J.fromTimestamp(e)}function Fr(n,e){const t=(e.baseMutations||[]).map((i=>vl(n.gt,i)));for(let i=0;i<e.mutations.length-1;++i){const o=e.mutations[i];if(i+1<e.mutations.length&&e.mutations[i+1].transform!==void 0){const a=e.mutations[i+1];o.updateTransforms=a.transform.fieldTransforms,e.mutations.splice(i+1,1),++i}}const r=e.mutations.map((i=>vl(n.gt,i))),s=_e.fromMillis(e.localWriteTimeMs);return new gh(e.batchId,s,t,r)}function mo(n){const e=ns(n.readTime),t=n.lastLimboFreeSnapshotVersion!==void 0?ns(n.lastLimboFreeSnapshotVersion):J.min();let r;return r=(function(i){return i.documents!==void 0})(n.query)?(function(i){const o=i.documents.length;return K(o===1,1966,{count:o}),dt(gi(q_(i.documents[0])))})(n.query):(function(i){return dt(K_(i))})(n.query),new Jt(r,n.targetId,"TargetPurposeListen",n.lastListenSequenceNumber,e,t,Fe.fromBase64String(n.resumeToken))}function X_(n,e){const t=ts(e.snapshotVersion),r=ts(e.lastLimboFreeSnapshotVersion);let s;s=pc(e.target)?G_(n.gt,e.target):Yc(n.gt,e.target).dt;const i=e.resumeToken.toBase64();return{targetId:e.targetId,canonicalId:Yr(e.target),readTime:t,resumeToken:i,lastListenSequenceNumber:e.sequenceNumber,lastLimboFreeSnapshotVersion:r,query:s}}function Xc(n){const e=K_({parent:n.parent,structuredQuery:n.structuredQuery});return n.limitType==="LAST"?_c(e,e.limit,"L"):e}function Uu(n,e){return new yh(e.largestBatchId,vl(n.gt,e.overlayMutation))}function Im(n,e){const t=e.path.lastSegment();return[n,ht(e.path.popLast()),t]}function wm(n,e,t,r){return{indexId:n,uid:e,sequenceNumber:t,readTime:ts(r.readTime),documentKey:ht(r.documentKey.path),largestBatchId:r.largestBatchId}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class pS{getBundleMetadata(e,t){return Em(e).get(t).next((r=>{if(r)return(function(i){return{id:i.bundleId,createTime:ns(i.createTime),version:i.version}})(r)}))}saveBundleMetadata(e,t){return Em(e).put((function(s){return{bundleId:s.id,createTime:ts(je(s.createTime)),version:s.version}})(t))}getNamedQuery(e,t){return Tm(e).get(t).next((r=>{if(r)return(function(i){return{name:i.name,query:Xc(i.bundledQuery),readTime:ns(i.readTime)}})(r)}))}saveNamedQuery(e,t){return Tm(e).put((function(s){return{name:s.name,readTime:ts(je(s.readTime)),bundledQuery:s.bundledQuery}})(t))}}function Em(n){return Ze(n,Uc)}function Tm(n){return Ze(n,$c)}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Zc{constructor(e,t){this.serializer=e,this.userId=t}static yt(e,t){const r=t.uid||"";return new Zc(e,r)}getOverlay(e,t){return eo(e).get(Im(this.userId,t)).next((r=>r?Uu(this.serializer,r):null))}getOverlays(e,t){const r=Qt();return S.forEach(t,(s=>this.getOverlay(e,s).next((i=>{i!==null&&r.set(s,i)})))).next((()=>r))}saveOverlays(e,t,r){const s=[];return r.forEach(((i,o)=>{const a=new yh(t,o);s.push(this.wt(e,a))})),S.waitFor(s)}removeOverlaysForBatchId(e,t,r){const s=new Set;t.forEach((o=>s.add(ht(o.getCollectionPath()))));const i=[];return s.forEach((o=>{const a=IDBKeyRange.bound([this.userId,o,r],[this.userId,o,r+1],!1,!0);i.push(eo(e).X(ml,a))})),S.waitFor(i)}getOverlaysForCollection(e,t,r){const s=Qt(),i=ht(t),o=IDBKeyRange.bound([this.userId,i,r],[this.userId,i,Number.POSITIVE_INFINITY],!0);return eo(e).J(ml,o).next((a=>{for(const u of a){const l=Uu(this.serializer,u);s.set(l.getKey(),l)}return s}))}getOverlaysForCollectionGroup(e,t,r,s){const i=Qt();let o;const a=IDBKeyRange.bound([this.userId,t,r],[this.userId,t,Number.POSITIVE_INFINITY],!0);return eo(e).ee({index:Hg,range:a},((u,l,h)=>{const f=Uu(this.serializer,l);i.size()<s||f.largestBatchId===o?(i.set(f.getKey(),f),o=f.largestBatchId):h.done()})).next((()=>i))}wt(e,t){return eo(e).put((function(s,i,o){const[a,u,l]=Im(i,o.mutation.key);return{userId:i,collectionPath:u,documentId:l,collectionGroup:o.mutation.key.getCollectionGroup(),largestBatchId:o.largestBatchId,overlayMutation:qo(s.gt,o.mutation)}})(this.serializer,this.userId,t))}}function eo(n){return Ze(n,qc)}/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class gS{St(e){return Ze(e,oh)}getSessionToken(e){return this.St(e).get("sessionToken").next((t=>{const r=t==null?void 0:t.value;return r?Fe.fromUint8Array(r):Fe.EMPTY_BYTE_STRING}))}setSessionToken(e,t){return this.St(e).put({name:"sessionToken",value:t.toUint8Array()})}}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Ur{constructor(){}bt(e,t){this.Dt(e,t),t.Ct()}Dt(e,t){if("nullValue"in e)this.vt(t,5);else if("booleanValue"in e)this.vt(t,10),t.Ft(e.booleanValue?1:0);else if("integerValue"in e)this.vt(t,15),t.Ft(De(e.integerValue));else if("doubleValue"in e){const r=De(e.doubleValue);isNaN(r)?this.vt(t,13):(this.vt(t,15),No(r)?t.Ft(0):t.Ft(r))}else if("timestampValue"in e){let r=e.timestampValue;this.vt(t,20),typeof r=="string"&&(r=In(r)),t.Mt(`${r.seconds||""}`),t.Ft(r.nanos||0)}else if("stringValue"in e)this.xt(e.stringValue,t),this.Ot(t);else if("bytesValue"in e)this.vt(t,30),t.Nt(wn(e.bytesValue)),this.Ot(t);else if("referenceValue"in e)this.Bt(e.referenceValue,t);else if("geoPointValue"in e){const r=e.geoPointValue;this.vt(t,45),t.Ft(r.latitude||0),t.Ft(r.longitude||0)}else"mapValue"in e?c_(e)?this.vt(t,Number.MAX_SAFE_INTEGER):zc(e)?this.Lt(e.mapValue,t):(this.kt(e.mapValue,t),this.Ot(t)):"arrayValue"in e?(this.qt(e.arrayValue,t),this.Ot(t)):j(19022,{Kt:e})}xt(e,t){this.vt(t,25),this.Ut(e,t)}Ut(e,t){t.Mt(e)}kt(e,t){const r=e.fields||{};this.vt(t,55);for(const s of Object.keys(r))this.xt(s,t),this.Dt(r[s],t)}Lt(e,t){var o,a;const r=e.fields||{};this.vt(t,53);const s=Zs,i=((a=(o=r[s].arrayValue)==null?void 0:o.values)==null?void 0:a.length)||0;this.vt(t,15),t.Ft(De(i)),this.xt(s,t),this.Dt(r[s],t)}qt(e,t){const r=e.values||[];this.vt(t,50);for(const s of r)this.Dt(s,t)}Bt(e,t){this.vt(t,37),B.fromName(e).path.forEach((r=>{this.vt(t,60),this.Ut(r,t)}))}vt(e,t){e.Ft(t)}Ot(e){e.Ft(2)}}Ur.$t=new Ur;/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law | agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES | CONDITIONS OF ANY KIND, either express | implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Ss=255;function _S(n){if(n===0)return 8;let e=0;return n>>4||(e+=4,n<<=4),n>>6||(e+=2,n<<=2),n>>7||(e+=1),e}function Am(n){const e=64-(function(r){let s=0;for(let i=0;i<8;++i){const o=_S(255&r[i]);if(s+=o,o!==8)break}return s})(n);return Math.ceil(e/8)}class yS{constructor(){this.buffer=new Uint8Array(1024),this.position=0}Wt(e){const t=e[Symbol.iterator]();let r=t.next();for(;!r.done;)this.Qt(r.value),r=t.next();this.Gt()}zt(e){const t=e[Symbol.iterator]();let r=t.next();for(;!r.done;)this.jt(r.value),r=t.next();this.Jt()}Ht(e){for(const t of e){const r=t.charCodeAt(0);if(r<128)this.Qt(r);else if(r<2048)this.Qt(960|r>>>6),this.Qt(128|63&r);else if(t<"\uD800"||"\uDBFF"<t)this.Qt(480|r>>>12),this.Qt(128|63&r>>>6),this.Qt(128|63&r);else{const s=t.codePointAt(0);this.Qt(240|s>>>18),this.Qt(128|63&s>>>12),this.Qt(128|63&s>>>6),this.Qt(128|63&s)}}this.Gt()}Zt(e){for(const t of e){const r=t.charCodeAt(0);if(r<128)this.jt(r);else if(r<2048)this.jt(960|r>>>6),this.jt(128|63&r);else if(t<"\uD800"||"\uDBFF"<t)this.jt(480|r>>>12),this.jt(128|63&r>>>6),this.jt(128|63&r);else{const s=t.codePointAt(0);this.jt(240|s>>>18),this.jt(128|63&s>>>12),this.jt(128|63&s>>>6),this.jt(128|63&s)}}this.Jt()}Xt(e){const t=this.Yt(e),r=Am(t);this.en(1+r),this.buffer[this.position++]=255&r;for(let s=t.length-r;s<t.length;++s)this.buffer[this.position++]=255&t[s]}tn(e){const t=this.Yt(e),r=Am(t);this.en(1+r),this.buffer[this.position++]=~(255&r);for(let s=t.length-r;s<t.length;++s)this.buffer[this.position++]=~(255&t[s])}nn(){this.rn(Ss),this.rn(255)}sn(){this._n(Ss),this._n(255)}reset(){this.position=0}seed(e){this.en(e.length),this.buffer.set(e,this.position),this.position+=e.length}an(){return this.buffer.slice(0,this.position)}Yt(e){const t=(function(i){const o=new DataView(new ArrayBuffer(8));return o.setFloat64(0,i,!1),new Uint8Array(o.buffer)})(e),r=!!(128&t[0]);t[0]^=r?255:128;for(let s=1;s<t.length;++s)t[s]^=r?255:0;return t}Qt(e){const t=255&e;t===0?(this.rn(0),this.rn(255)):t===Ss?(this.rn(Ss),this.rn(0)):this.rn(t)}jt(e){const t=255&e;t===0?(this._n(0),this._n(255)):t===Ss?(this._n(Ss),this._n(0)):this._n(e)}Gt(){this.rn(0),this.rn(1)}Jt(){this._n(0),this._n(1)}rn(e){this.en(1),this.buffer[this.position++]=e}_n(e){this.en(1),this.buffer[this.position++]=~e}en(e){const t=e+this.position;if(t<=this.buffer.length)return;let r=2*this.buffer.length;r<t&&(r=t);const s=new Uint8Array(r);s.set(this.buffer),this.buffer=s}}class IS{constructor(e){this.un=e}Nt(e){this.un.Wt(e)}Mt(e){this.un.Ht(e)}Ft(e){this.un.Xt(e)}Ct(){this.un.nn()}}class wS{constructor(e){this.un=e}Nt(e){this.un.zt(e)}Mt(e){this.un.Zt(e)}Ft(e){this.un.tn(e)}Ct(){this.un.sn()}}class to{constructor(){this.un=new yS,this.ascending=new IS(this.un),this.descending=new wS(this.un)}seed(e){this.un.seed(e)}cn(e){return e===0?this.ascending:this.descending}an(){return this.un.an()}reset(){this.un.reset()}}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class $r{constructor(e,t,r,s){this.ln=e,this.hn=t,this.Pn=r,this.Tn=s}In(){const e=this.Tn.length,t=e===0||this.Tn[e-1]===255?e+1:e,r=new Uint8Array(t);return r.set(this.Tn,0),t!==e?r.set([0],this.Tn.length):++r[r.length-1],new $r(this.ln,this.hn,this.Pn,r)}En(e,t,r){return{indexId:this.ln,uid:e,arrayValue:Za(this.Pn),directionalValue:Za(this.Tn),orderedDocumentKey:Za(t),documentKey:r.path.toArray()}}Rn(e,t,r){const s=this.En(e,t,r);return[s.indexId,s.uid,s.arrayValue,s.directionalValue,s.orderedDocumentKey,s.documentKey]}}function qn(n,e){let t=n.ln-e.ln;return t!==0?t:(t=vm(n.Pn,e.Pn),t!==0?t:(t=vm(n.Tn,e.Tn),t!==0?t:B.comparator(n.hn,e.hn)))}function vm(n,e){for(let t=0;t<n.length&&t<e.length;++t){const r=n[t]-e[t];if(r!==0)return r}return n.length-e.length}function Za(n){return Fp()?(function(t){let r="";for(let s=0;s<t.length;s++)r+=String.fromCharCode(t[s]);return r})(n):n}function bm(n){return typeof n!="string"?n:(function(t){const r=new Uint8Array(t.length);for(let s=0;s<t.length;s++)r[s]=t.charCodeAt(s);return r})(n)}class Sm{constructor(e){this.An=new Ie(((t,r)=>Ve.comparator(t.field,r.field))),this.collectionId=e.collectionGroup!=null?e.collectionGroup:e.path.lastSegment(),this.Vn=e.orderBy,this.dn=[];for(const t of e.filters){const r=t;r.isInequality()?this.An=this.An.add(r):this.dn.push(r)}}get mn(){return this.An.size>1}fn(e){if(K(e.collectionGroup===this.collectionId,49279),this.mn)return!1;const t=hl(e);if(t!==void 0&&!this.gn(t))return!1;const r=Mr(e);let s=new Set,i=0,o=0;for(;i<r.length&&this.gn(r[i]);++i)s=s.add(r[i].fieldPath.canonicalString());if(i===r.length)return!0;if(this.An.size>0){const a=this.An.getIterator().getNext();if(!s.has(a.field.canonicalString())){const u=r[i];if(!this.pn(a,u)||!this.yn(this.Vn[o++],u))return!1}++i}for(;i<r.length;++i){const a=r[i];if(o>=this.Vn.length||!this.yn(this.Vn[o++],a))return!1}return!0}wn(){if(this.mn)return null;let e=new Ie(Ve.comparator);const t=[];for(const r of this.dn)if(!r.field.isKeyField())if(r.op==="array-contains"||r.op==="array-contains-any")t.push(new jr(r.field,2));else{if(e.has(r.field))continue;e=e.add(r.field),t.push(new jr(r.field,0))}for(const r of this.Vn)r.field.isKeyField()||e.has(r.field)||(e=e.add(r.field),t.push(new jr(r.field,r.dir==="asc"?0:1)));return new Ws(Ws.UNKNOWN_ID,this.collectionId,t,Hs.empty())}gn(e){for(const t of this.dn)if(this.pn(t,e))return!0;return!1}pn(e,t){if(e===void 0||!e.field.isEqual(t.fieldPath))return!1;const r=e.op==="array-contains"||e.op==="array-contains-any";return t.kind===2===r}yn(e,t){return!!e.field.isEqual(t.fieldPath)&&(t.kind===0&&e.dir==="asc"||t.kind===1&&e.dir==="desc")}}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Z_(n){var t,r;if(K(n instanceof ue||n instanceof ye,20012),n instanceof ue){if(n instanceof __){const s=((r=(t=n.value.arrayValue)==null?void 0:t.values)==null?void 0:r.map((i=>ue.create(n.field,"==",i))))||[];return ye.create(s,"or")}return n}const e=n.filters.map((s=>Z_(s)));return ye.create(e,n.op)}function ES(n){if(n.getFilters().length===0)return[];const e=Rl(Z_(n));return K(ey(e),7391),bl(e)||Sl(e)?[e]:e.getFilters()}function bl(n){return n instanceof ue}function Sl(n){return n instanceof ye&&lh(n)}function ey(n){return bl(n)||Sl(n)||(function(t){if(t instanceof ye&&_l(t)){for(const r of t.getFilters())if(!bl(r)&&!Sl(r))return!1;return!0}return!1})(n)}function Rl(n){if(K(n instanceof ue||n instanceof ye,34018),n instanceof ue)return n;if(n.filters.length===1)return Rl(n.filters[0]);const e=n.filters.map((r=>Rl(r)));let t=ye.create(e,n.op);return t=wc(t),ey(t)?t:(K(t instanceof ye,64498),K(ti(t),40251),K(t.filters.length>1,57927),t.filters.reduce(((r,s)=>Eh(r,s))))}function Eh(n,e){let t;return K(n instanceof ue||n instanceof ye,38388),K(e instanceof ue||e instanceof ye,25473),t=n instanceof ue?e instanceof ue?(function(s,i){return ye.create([s,i],"and")})(n,e):Rm(n,e):e instanceof ue?Rm(e,n):(function(s,i){if(K(s.filters.length>0&&i.filters.length>0,48005),ti(s)&&ti(i))return m_(s,i.getFilters());const o=_l(s)?s:i,a=_l(s)?i:s,u=o.filters.map((l=>Eh(l,a)));return ye.create(u,"or")})(n,e),wc(t)}function Rm(n,e){if(ti(e))return m_(e,n.getFilters());{const t=e.filters.map((r=>Eh(n,r)));return ye.create(t,"or")}}function wc(n){if(K(n instanceof ue||n instanceof ye,11850),n instanceof ue)return n;const e=n.getFilters();if(e.length===1)return wc(e[0]);if(d_(n))return n;const t=e.map((s=>wc(s))),r=[];return t.forEach((s=>{s instanceof ue?r.push(s):s instanceof ye&&(s.op===n.op?r.push(...s.filters):r.push(s))})),r.length===1?r[0]:ye.create(r,n.op)}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class TS{constructor(){this.Sn=new Th}addToCollectionParentIndex(e,t){return this.Sn.add(t),S.resolve()}getCollectionParents(e,t){return S.resolve(this.Sn.getEntries(t))}addFieldIndex(e,t){return S.resolve()}deleteFieldIndex(e,t){return S.resolve()}deleteAllFieldIndexes(e){return S.resolve()}createTargetIndexes(e,t){return S.resolve()}getDocumentsMatchingTarget(e,t){return S.resolve(null)}getIndexType(e,t){return S.resolve(0)}getFieldIndexes(e,t){return S.resolve([])}getNextCollectionGroupToUpdate(e){return S.resolve(null)}getMinOffset(e,t){return S.resolve(Pt.min())}getMinOffsetFromCollectionGroup(e,t){return S.resolve(Pt.min())}updateCollectionGroup(e,t,r){return S.resolve()}updateIndexEntries(e,t){return S.resolve()}}class Th{constructor(){this.index={}}add(e){const t=e.lastSegment(),r=e.popLast(),s=this.index[t]||new Ie(oe.comparator),i=!s.has(r);return this.index[t]=s.add(r),i}has(e){const t=e.lastSegment(),r=e.popLast(),s=this.index[t];return s&&s.has(r)}getEntries(e){return(this.index[e]||new Ie(oe.comparator)).toArray()}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Pm="IndexedDbIndexManager",Va=new Uint8Array(0);class AS{constructor(e,t){this.databaseId=t,this.bn=new Th,this.Dn=new Sn((r=>Yr(r)),((r,s)=>na(r,s))),this.uid=e.uid||""}addToCollectionParentIndex(e,t){if(!this.bn.has(t)){const r=t.lastSegment(),s=t.popLast();e.addOnCommittedListener((()=>{this.bn.add(t)}));const i={collectionId:r,parent:ht(s)};return km(e).put(i)}return S.resolve()}getCollectionParents(e,t){const r=[],s=IDBKeyRange.bound([t,""],[Og(t),""],!1,!0);return km(e).J(s).next((i=>{for(const o of i){if(o.collectionId!==t)break;r.push(Ht(o.parent))}return r}))}addFieldIndex(e,t){const r=no(e),s=(function(a){return{indexId:a.indexId,collectionGroup:a.collectionGroup,fields:a.fields.map((u=>[u.fieldPath.canonicalString(),u.kind]))}})(t);delete s.indexId;const i=r.add(s);if(t.indexState){const o=Ps(e);return i.next((a=>{o.put(wm(a,this.uid,t.indexState.sequenceNumber,t.indexState.offset))}))}return i.next()}deleteFieldIndex(e,t){const r=no(e),s=Ps(e),i=Rs(e);return r.delete(t.indexId).next((()=>s.delete(IDBKeyRange.bound([t.indexId],[t.indexId+1],!1,!0)))).next((()=>i.delete(IDBKeyRange.bound([t.indexId],[t.indexId+1],!1,!0))))}deleteAllFieldIndexes(e){const t=no(e),r=Rs(e),s=Ps(e);return t.X().next((()=>r.X())).next((()=>s.X()))}createTargetIndexes(e,t){return S.forEach(this.Cn(t),(r=>this.getIndexType(e,r).next((s=>{if(s===0||s===1){const i=new Sm(r).wn();if(i!=null)return this.addFieldIndex(e,i)}}))))}getDocumentsMatchingTarget(e,t){const r=Rs(e);let s=!0;const i=new Map;return S.forEach(this.Cn(t),(o=>this.vn(e,o).next((a=>{s&&(s=!!a),i.set(o,a)})))).next((()=>{if(s){let o=re();const a=[];return S.forEach(i,((u,l)=>{x(Pm,`Using index ${(function(L){return`id=${L.indexId}|cg=${L.collectionGroup}|f=${L.fields.map((z=>`${z.fieldPath}:${z.kind}`)).join(",")}`})(u)} to execute ${Yr(t)}`);const h=(function(L,z){const ne=hl(z);if(ne===void 0)return null;for(const H of gc(L,ne.fieldPath))switch(H.op){case"array-contains-any":return H.value.arrayValue.values||[];case"array-contains":return[H.value]}return null})(l,u),f=(function(L,z){const ne=new Map;for(const H of Mr(z))for(const T of gc(L,H.fieldPath))switch(T.op){case"==":case"in":ne.set(H.fieldPath.canonicalString(),T.value);break;case"not-in":case"!=":return ne.set(H.fieldPath.canonicalString(),T.value),Array.from(ne.values())}return null})(l,u),p=(function(L,z){const ne=[];let H=!0;for(const T of Mr(z)){const y=T.kind===0?om(L,T.fieldPath,L.startAt):am(L,T.fieldPath,L.startAt);ne.push(y.value),H&&(H=y.inclusive)}return new hr(ne,H)})(l,u),_=(function(L,z){const ne=[];let H=!0;for(const T of Mr(z)){const y=T.kind===0?am(L,T.fieldPath,L.endAt):om(L,T.fieldPath,L.endAt);ne.push(y.value),H&&(H=y.inclusive)}return new hr(ne,H)})(l,u),w=this.Fn(u,l,p),b=this.Fn(u,l,_),C=this.Mn(u,l,f),V=this.xn(u.indexId,h,w,p.inclusive,b,_.inclusive,C);return S.forEach(V,(O=>r.Z(O,t.limit).next((L=>{L.forEach((z=>{const ne=B.fromSegments(z.documentKey);o.has(ne)||(o=o.add(ne),a.push(ne))}))}))))})).next((()=>a))}return S.resolve(null)}))}Cn(e){let t=this.Dn.get(e);return t||(e.filters.length===0?t=[e]:t=ES(ye.create(e.filters,"and")).map((r=>Il(e.path,e.collectionGroup,e.orderBy,r.getFilters(),e.limit,e.startAt,e.endAt))),this.Dn.set(e,t),t)}xn(e,t,r,s,i,o,a){const u=(t!=null?t.length:1)*Math.max(r.length,i.length),l=u/(t!=null?t.length:1),h=[];for(let f=0;f<u;++f){const p=t?this.On(t[f/l]):Va,_=this.Nn(e,p,r[f%l],s),w=this.Bn(e,p,i[f%l],o),b=a.map((C=>this.Nn(e,p,C,!0)));h.push(...this.createRange(_,w,b))}return h}Nn(e,t,r,s){const i=new $r(e,B.empty(),t,r);return s?i:i.In()}Bn(e,t,r,s){const i=new $r(e,B.empty(),t,r);return s?i.In():i}vn(e,t){const r=new Sm(t),s=t.collectionGroup!=null?t.collectionGroup:t.path.lastSegment();return this.getFieldIndexes(e,s).next((i=>{let o=null;for(const a of i)r.fn(a)&&(!o||a.fields.length>o.fields.length)&&(o=a);return o}))}getIndexType(e,t){let r=2;const s=this.Cn(t);return S.forEach(s,(i=>this.vn(e,i).next((o=>{o?r!==0&&o.fields.length<(function(u){let l=new Ie(Ve.comparator),h=!1;for(const f of u.filters)for(const p of f.getFlattenedFilters())p.field.isKeyField()||(p.op==="array-contains"||p.op==="array-contains-any"?h=!0:l=l.add(p.field));for(const f of u.orderBy)f.field.isKeyField()||(l=l.add(f.field));return l.size+(h?1:0)})(i)&&(r=1):r=0})))).next((()=>(function(o){return o.limit!==null})(t)&&s.length>1&&r===2?1:r))}Ln(e,t){const r=new to;for(const s of Mr(e)){const i=t.data.field(s.fieldPath);if(i==null)return null;const o=r.cn(s.kind);Ur.$t.bt(i,o)}return r.an()}On(e){const t=new to;return Ur.$t.bt(e,t.cn(0)),t.an()}kn(e,t){const r=new to;return Ur.$t.bt(Jr(this.databaseId,t),r.cn((function(i){const o=Mr(i);return o.length===0?0:o[o.length-1].kind})(e))),r.an()}Mn(e,t,r){if(r===null)return[];let s=[];s.push(new to);let i=0;for(const o of Mr(e)){const a=r[i++];for(const u of s)if(this.qn(t,o.fieldPath)&&Fo(a))s=this.Kn(s,o,a);else{const l=u.cn(o.kind);Ur.$t.bt(a,l)}}return this.Un(s)}Fn(e,t,r){return this.Mn(e,t,r.position)}Un(e){const t=[];for(let r=0;r<e.length;++r)t[r]=e[r].an();return t}Kn(e,t,r){const s=[...e],i=[];for(const o of r.arrayValue.values||[])for(const a of s){const u=new to;u.seed(a.an()),Ur.$t.bt(o,u.cn(t.kind)),i.push(u)}return i}qn(e,t){return!!e.filters.find((r=>r instanceof ue&&r.field.isEqual(t)&&(r.op==="in"||r.op==="not-in")))}getFieldIndexes(e,t){const r=no(e),s=Ps(e);return(t?r.J(fl,IDBKeyRange.bound(t,t)):r.J()).next((i=>{const o=[];return S.forEach(i,(a=>s.get([a.indexId,this.uid]).next((u=>{o.push((function(h,f){const p=f?new Hs(f.sequenceNumber,new Pt(ns(f.readTime),new B(Ht(f.documentKey)),f.largestBatchId)):Hs.empty(),_=h.fields.map((([w,b])=>new jr(Ve.fromServerFormat(w),b)));return new Ws(h.indexId,h.collectionGroup,_,p)})(a,u))})))).next((()=>o))}))}getNextCollectionGroupToUpdate(e){return this.getFieldIndexes(e).next((t=>t.length===0?null:(t.sort(((r,s)=>{const i=r.indexState.sequenceNumber-s.indexState.sequenceNumber;return i!==0?i:Z(r.collectionGroup,s.collectionGroup)})),t[0].collectionGroup)))}updateCollectionGroup(e,t,r){const s=no(e),i=Ps(e);return this.$n(e).next((o=>s.J(fl,IDBKeyRange.bound(t,t)).next((a=>S.forEach(a,(u=>i.put(wm(u.indexId,this.uid,o,r))))))))}updateIndexEntries(e,t){const r=new Map;return S.forEach(t,((s,i)=>{const o=r.get(s.collectionGroup);return(o?S.resolve(o):this.getFieldIndexes(e,s.collectionGroup)).next((a=>(r.set(s.collectionGroup,a),S.forEach(a,(u=>this.Wn(e,s,u).next((l=>{const h=this.Qn(i,u);return l.isEqual(h)?S.resolve():this.Gn(e,i,u,l,h)})))))))}))}zn(e,t,r,s){return Rs(e).put(s.En(this.uid,this.kn(r,t.key),t.key))}jn(e,t,r,s){return Rs(e).delete(s.Rn(this.uid,this.kn(r,t.key),t.key))}Wn(e,t,r){const s=Rs(e);let i=new Ie(qn);return s.ee({index:Wg,range:IDBKeyRange.only([r.indexId,this.uid,Za(this.kn(r,t))])},((o,a)=>{i=i.add(new $r(r.indexId,t,bm(a.arrayValue),bm(a.directionalValue)))})).next((()=>i))}Qn(e,t){let r=new Ie(qn);const s=this.Ln(t,e);if(s==null)return r;const i=hl(t);if(i!=null){const o=e.data.field(i.fieldPath);if(Fo(o))for(const a of o.arrayValue.values||[])r=r.add(new $r(t.indexId,e.key,this.On(a),s))}else r=r.add(new $r(t.indexId,e.key,Va,s));return r}Gn(e,t,r,s,i){x(Pm,"Updating index entries for document '%s'",t.key);const o=[];return(function(u,l,h,f,p){const _=u.getIterator(),w=l.getIterator();let b=bs(_),C=bs(w);for(;b||C;){let V=!1,O=!1;if(b&&C){const L=h(b,C);L<0?O=!0:L>0&&(V=!0)}else b!=null?O=!0:V=!0;V?(f(C),C=bs(w)):O?(p(b),b=bs(_)):(b=bs(_),C=bs(w))}})(s,i,qn,(a=>{o.push(this.zn(e,t,r,a))}),(a=>{o.push(this.jn(e,t,r,a))})),S.waitFor(o)}$n(e){let t=1;return Ps(e).ee({index:Kg,reverse:!0,range:IDBKeyRange.upperBound([this.uid,Number.MAX_SAFE_INTEGER])},((r,s,i)=>{i.done(),t=s.sequenceNumber+1})).next((()=>t))}createRange(e,t,r){r=r.sort(((o,a)=>qn(o,a))).filter(((o,a,u)=>!a||qn(o,u[a-1])!==0));const s=[];s.push(e);for(const o of r){const a=qn(o,e),u=qn(o,t);if(a===0)s[0]=e.In();else if(a>0&&u<0)s.push(o),s.push(o.In());else if(u>0)break}s.push(t);const i=[];for(let o=0;o<s.length;o+=2){if(this.Jn(s[o],s[o+1]))return[];const a=s[o].Rn(this.uid,Va,B.empty()),u=s[o+1].Rn(this.uid,Va,B.empty());i.push(IDBKeyRange.bound(a,u))}return i}Jn(e,t){return qn(e,t)>0}getMinOffsetFromCollectionGroup(e,t){return this.getFieldIndexes(e,t).next(Cm)}getMinOffset(e,t){return S.mapArray(this.Cn(t),(r=>this.vn(e,r).next((s=>s||j(44426))))).next(Cm)}}function km(n){return Ze(n,Oo)}function Rs(n){return Ze(n,Io)}function no(n){return Ze(n,ih)}function Ps(n){return Ze(n,yo)}function Cm(n){K(n.length!==0,28825);let e=n[0].indexState.offset,t=e.largestBatchId;for(let r=1;r<n.length;r++){const s=n[r].indexState.offset;nh(s,e)<0&&(e=s),t<s.largestBatchId&&(t=s.largestBatchId)}return new Pt(e.readTime,e.documentKey,t)}/**
 * @license
 * Copyright 2018 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Nm={didRun:!1,sequenceNumbersCollected:0,targetsRemoved:0,documentsRemoved:0},ty=41943040;class lt{static withCacheSize(e){return new lt(e,lt.DEFAULT_COLLECTION_PERCENTILE,lt.DEFAULT_MAX_SEQUENCE_NUMBERS_TO_COLLECT)}constructor(e,t,r){this.cacheSizeCollectionThreshold=e,this.percentileToCollect=t,this.maximumSequenceNumbersToCollect=r}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function ny(n,e,t){const r=n.store(Ot),s=n.store(Qs),i=[],o=IDBKeyRange.only(t.batchId);let a=0;const u=r.ee({range:o},((h,f,p)=>(a++,p.delete())));i.push(u.next((()=>{K(a===1,47070,{batchId:t.batchId})})));const l=[];for(const h of t.mutations){const f=jg(e,h.key.path,t.batchId);i.push(s.delete(f)),l.push(h.key)}return S.waitFor(i).next((()=>l))}function Ec(n){if(!n)return 0;let e;if(n.document)e=n.document;else if(n.unknownDocument)e=n.unknownDocument;else{if(!n.noDocument)throw j(14731);e=n.noDocument}return JSON.stringify(e).length}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */lt.DEFAULT_COLLECTION_PERCENTILE=10,lt.DEFAULT_MAX_SEQUENCE_NUMBERS_TO_COLLECT=1e3,lt.DEFAULT=new lt(ty,lt.DEFAULT_COLLECTION_PERCENTILE,lt.DEFAULT_MAX_SEQUENCE_NUMBERS_TO_COLLECT),lt.DISABLED=new lt(-1,0,0);class eu{constructor(e,t,r,s){this.userId=e,this.serializer=t,this.indexManager=r,this.referenceDelegate=s,this.Hn={}}static yt(e,t,r,s){K(e.uid!=="",64387);const i=e.isAuthenticated()?e.uid:"";return new eu(i,t,r,s)}checkEmpty(e){let t=!0;const r=IDBKeyRange.bound([this.userId,Number.NEGATIVE_INFINITY],[this.userId,Number.POSITIVE_INFINITY]);return jn(e).ee({index:qr,range:r},((s,i,o)=>{t=!1,o.done()})).next((()=>t))}addMutationBatch(e,t,r,s){const i=Vs(e),o=jn(e);return o.add({}).next((a=>{K(typeof a=="number",49019);const u=new gh(a,t,r,s),l=(function(_,w,b){const C=b.baseMutations.map((O=>qo(_.gt,O))),V=b.mutations.map((O=>qo(_.gt,O)));return{userId:w,batchId:b.batchId,localWriteTimeMs:b.localWriteTime.toMillis(),baseMutations:C,mutations:V}})(this.serializer,this.userId,u),h=[];let f=new Ie(((p,_)=>Z(p.canonicalString(),_.canonicalString())));for(const p of s){const _=jg(this.userId,p.key.path,a);f=f.add(p.key.path.popLast()),h.push(o.put(l)),h.push(i.put(_,Zv))}return f.forEach((p=>{h.push(this.indexManager.addToCollectionParentIndex(e,p))})),e.addOnCommittedListener((()=>{this.Hn[a]=u.keys()})),S.waitFor(h).next((()=>u))}))}lookupMutationBatch(e,t){return jn(e).get(t).next((r=>r?(K(r.userId===this.userId,48,"Unexpected user for mutation batch",{userId:r.userId,batchId:t}),Fr(this.serializer,r)):null))}Zn(e,t){return this.Hn[t]?S.resolve(this.Hn[t]):this.lookupMutationBatch(e,t).next((r=>{if(r){const s=r.keys();return this.Hn[t]=s,s}return null}))}getNextMutationBatchAfterBatchId(e,t){const r=t+1,s=IDBKeyRange.lowerBound([this.userId,r]);let i=null;return jn(e).ee({index:qr,range:s},((o,a,u)=>{a.userId===this.userId&&(K(a.batchId>=r,47524,{Xn:r}),i=Fr(this.serializer,a)),u.done()})).next((()=>i))}getHighestUnacknowledgedBatchId(e){const t=IDBKeyRange.upperBound([this.userId,Number.POSITIVE_INFINITY]);let r=or;return jn(e).ee({index:qr,range:t,reverse:!0},((s,i,o)=>{r=i.batchId,o.done()})).next((()=>r))}getAllMutationBatches(e){const t=IDBKeyRange.bound([this.userId,or],[this.userId,Number.POSITIVE_INFINITY]);return jn(e).J(qr,t).next((r=>r.map((s=>Fr(this.serializer,s)))))}getAllMutationBatchesAffectingDocumentKey(e,t){const r=Ka(this.userId,t.path),s=IDBKeyRange.lowerBound(r),i=[];return Vs(e).ee({range:s},((o,a,u)=>{const[l,h,f]=o,p=Ht(h);if(l===this.userId&&t.path.isEqual(p))return jn(e).get(f).next((_=>{if(!_)throw j(61480,{Yn:o,batchId:f});K(_.userId===this.userId,10503,"Unexpected user for mutation batch",{userId:_.userId,batchId:f}),i.push(Fr(this.serializer,_))}));u.done()})).next((()=>i))}getAllMutationBatchesAffectingDocumentKeys(e,t){let r=new Ie(Z);const s=[];return t.forEach((i=>{const o=Ka(this.userId,i.path),a=IDBKeyRange.lowerBound(o),u=Vs(e).ee({range:a},((l,h,f)=>{const[p,_,w]=l,b=Ht(_);p===this.userId&&i.path.isEqual(b)?r=r.add(w):f.done()}));s.push(u)})),S.waitFor(s).next((()=>this.er(e,r)))}getAllMutationBatchesAffectingQuery(e,t){const r=t.path,s=r.length+1,i=Ka(this.userId,r),o=IDBKeyRange.lowerBound(i);let a=new Ie(Z);return Vs(e).ee({range:o},((u,l,h)=>{const[f,p,_]=u,w=Ht(p);f===this.userId&&r.isPrefixOf(w)?w.length===s&&(a=a.add(_)):h.done()})).next((()=>this.er(e,a)))}er(e,t){const r=[],s=[];return t.forEach((i=>{s.push(jn(e).get(i).next((o=>{if(o===null)throw j(35274,{batchId:i});K(o.userId===this.userId,9748,"Unexpected user for mutation batch",{userId:o.userId,batchId:i}),r.push(Fr(this.serializer,o))})))})),S.waitFor(s).next((()=>r))}removeMutationBatch(e,t){return ny(e.le,this.userId,t).next((r=>(e.addOnCommittedListener((()=>{this.tr(t.batchId)})),S.forEach(r,(s=>this.referenceDelegate.markPotentiallyOrphaned(e,s))))))}tr(e){delete this.Hn[e]}performConsistencyCheck(e){return this.checkEmpty(e).next((t=>{if(!t)return S.resolve();const r=IDBKeyRange.lowerBound((function(o){return[o]})(this.userId)),s=[];return Vs(e).ee({range:r},((i,o,a)=>{if(i[0]===this.userId){const u=Ht(i[1]);s.push(u)}else a.done()})).next((()=>{K(s.length===0,56720,{nr:s.map((i=>i.canonicalString()))})}))}))}containsKey(e,t){return ry(e,this.userId,t)}rr(e){return sy(e).get(this.userId).next((t=>t||{userId:this.userId,lastAcknowledgedBatchId:or,lastStreamToken:""}))}}function ry(n,e,t){const r=Ka(e,t.path),s=r[1],i=IDBKeyRange.lowerBound(r);let o=!1;return Vs(n).ee({range:i,Y:!0},((a,u,l)=>{const[h,f,p]=a;h===e&&f===s&&(o=!0),l.done()})).next((()=>o))}function jn(n){return Ze(n,Ot)}function Vs(n){return Ze(n,Qs)}function sy(n){return Ze(n,Do)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class En{constructor(e){this.ir=e}next(){return this.ir+=2,this.ir}static sr(){return new En(0)}static _r(){return new En(-1)}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class vS{constructor(e,t){this.referenceDelegate=e,this.serializer=t}allocateTargetId(e){return this.ar(e).next((t=>{const r=new En(t.highestTargetId);return t.highestTargetId=r.next(),this.ur(e,t).next((()=>t.highestTargetId))}))}getLastRemoteSnapshotVersion(e){return this.ar(e).next((t=>J.fromTimestamp(new _e(t.lastRemoteSnapshotVersion.seconds,t.lastRemoteSnapshotVersion.nanoseconds))))}getHighestSequenceNumber(e){return this.ar(e).next((t=>t.highestListenSequenceNumber))}setTargetsMetadata(e,t,r){return this.ar(e).next((s=>(s.highestListenSequenceNumber=t,r&&(s.lastRemoteSnapshotVersion=r.toTimestamp()),t>s.highestListenSequenceNumber&&(s.highestListenSequenceNumber=t),this.ur(e,s))))}addTargetData(e,t){return this.cr(e,t).next((()=>this.ar(e).next((r=>(r.targetCount+=1,this.lr(t,r),this.ur(e,r))))))}updateTargetData(e,t){return this.cr(e,t)}removeTargetData(e,t){return this.removeMatchingKeysForTargetId(e,t.targetId).next((()=>ks(e).delete(t.targetId))).next((()=>this.ar(e))).next((r=>(K(r.targetCount>0,8065),r.targetCount-=1,this.ur(e,r))))}removeTargets(e,t,r){let s=0;const i=[];return ks(e).ee(((o,a)=>{const u=mo(a);u.sequenceNumber<=t&&r.get(u.targetId)===null&&(s++,i.push(this.removeTargetData(e,u)))})).next((()=>S.waitFor(i))).next((()=>s))}forEachTarget(e,t){return ks(e).ee(((r,s)=>{const i=mo(s);t(i)}))}ar(e){return Dm(e).get(mc).next((t=>(K(t!==null,2888),t)))}ur(e,t){return Dm(e).put(mc,t)}cr(e,t){return ks(e).put(X_(this.serializer,t))}lr(e,t){let r=!1;return e.targetId>t.highestTargetId&&(t.highestTargetId=e.targetId,r=!0),e.sequenceNumber>t.highestListenSequenceNumber&&(t.highestListenSequenceNumber=e.sequenceNumber,r=!0),r}getTargetCount(e){return this.ar(e).next((t=>t.targetCount))}getTargetData(e,t){const r=Yr(t),s=IDBKeyRange.bound([r,Number.NEGATIVE_INFINITY],[r,Number.POSITIVE_INFINITY]);let i=null;return ks(e).ee({range:s,index:zg},((o,a,u)=>{const l=mo(a);na(t,l.target)&&(i=l,u.done())})).next((()=>i))}addMatchingKeys(e,t,r){const s=[],i=Jn(e);return t.forEach((o=>{const a=ht(o.path);s.push(i.put({targetId:r,path:a})),s.push(this.referenceDelegate.addReference(e,r,o))})),S.waitFor(s)}removeMatchingKeys(e,t,r){const s=Jn(e);return S.forEach(t,(i=>{const o=ht(i.path);return S.waitFor([s.delete([r,o]),this.referenceDelegate.removeReference(e,r,i)])}))}removeMatchingKeysForTargetId(e,t){const r=Jn(e),s=IDBKeyRange.bound([t],[t+1],!1,!0);return r.delete(s)}getMatchingKeysForTargetId(e,t){const r=IDBKeyRange.bound([t],[t+1],!1,!0),s=Jn(e);let i=re();return s.ee({range:r,Y:!0},((o,a,u)=>{const l=Ht(o[1]),h=new B(l);i=i.add(h)})).next((()=>i))}containsKey(e,t){const r=ht(t.path),s=IDBKeyRange.bound([r],[Og(r)],!1,!0);let i=0;return Jn(e).ee({index:sh,Y:!0,range:s},(([o,a],u,l)=>{o!==0&&(i++,l.done())})).next((()=>i>0))}Rt(e,t){return ks(e).get(t).next((r=>r?mo(r):null))}}function ks(n){return Ze(n,Js)}function Dm(n){return Ze(n,Gr)}function Jn(n){return Ze(n,Ys)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Vm="LruGarbageCollector",iy=1048576;function Om([n,e],[t,r]){const s=Z(n,t);return s===0?Z(e,r):s}class bS{constructor(e){this.hr=e,this.buffer=new Ie(Om),this.Pr=0}Tr(){return++this.Pr}Ir(e){const t=[e,this.Tr()];if(this.buffer.size<this.hr)this.buffer=this.buffer.add(t);else{const r=this.buffer.last();Om(t,r)<0&&(this.buffer=this.buffer.delete(r).add(t))}}get maxValue(){return this.buffer.last()[0]}}class oy{constructor(e,t,r){this.garbageCollector=e,this.asyncQueue=t,this.localStore=r,this.Er=null}start(){this.garbageCollector.params.cacheSizeCollectionThreshold!==-1&&this.Rr(6e4)}stop(){this.Er&&(this.Er.cancel(),this.Er=null)}get started(){return this.Er!==null}Rr(e){x(Vm,`Garbage collection scheduled in ${e}ms`),this.Er=this.asyncQueue.enqueueAfterDelay("lru_garbage_collection",e,(async()=>{this.Er=null;try{await this.localStore.collectGarbage(this.garbageCollector)}catch(t){Ir(t)?x(Vm,"Ignoring IndexedDB error during garbage collection: ",t):await yr(t)}await this.Rr(3e5)}))}}class SS{constructor(e,t){this.Ar=e,this.params=t}calculateTargetCount(e,t){return this.Ar.Vr(e).next((r=>Math.floor(t/100*r)))}nthSequenceNumber(e,t){if(t===0)return S.resolve(gt.ce);const r=new bS(t);return this.Ar.forEachTarget(e,(s=>r.Ir(s.sequenceNumber))).next((()=>this.Ar.dr(e,(s=>r.Ir(s))))).next((()=>r.maxValue))}removeTargets(e,t,r){return this.Ar.removeTargets(e,t,r)}removeOrphanedDocuments(e,t){return this.Ar.removeOrphanedDocuments(e,t)}collect(e,t){return this.params.cacheSizeCollectionThreshold===-1?(x("LruGarbageCollector","Garbage collection skipped; disabled"),S.resolve(Nm)):this.getCacheSize(e).next((r=>r<this.params.cacheSizeCollectionThreshold?(x("LruGarbageCollector",`Garbage collection skipped; Cache size ${r} is lower than threshold ${this.params.cacheSizeCollectionThreshold}`),Nm):this.mr(e,t)))}getCacheSize(e){return this.Ar.getCacheSize(e)}mr(e,t){let r,s,i,o,a,u,l;const h=Date.now();return this.calculateTargetCount(e,this.params.percentileToCollect).next((f=>(f>this.params.maximumSequenceNumbersToCollect?(x("LruGarbageCollector",`Capping sequence numbers to collect down to the maximum of ${this.params.maximumSequenceNumbersToCollect} from ${f}`),s=this.params.maximumSequenceNumbersToCollect):s=f,o=Date.now(),this.nthSequenceNumber(e,s)))).next((f=>(r=f,a=Date.now(),this.removeTargets(e,r,t)))).next((f=>(i=f,u=Date.now(),this.removeOrphanedDocuments(e,r)))).next((f=>(l=Date.now(),Cs()<=ce.DEBUG&&x("LruGarbageCollector",`LRU Garbage Collection
	Counted targets in ${o-h}ms
	Determined least recently used ${s} in `+(a-o)+`ms
	Removed ${i} targets in `+(u-a)+`ms
	Removed ${f} documents in `+(l-u)+`ms
Total Duration: ${l-h}ms`),S.resolve({didRun:!0,sequenceNumbersCollected:s,targetsRemoved:i,documentsRemoved:f}))))}}function ay(n,e){return new SS(n,e)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class RS{constructor(e,t){this.db=e,this.garbageCollector=ay(this,t)}Vr(e){const t=this.gr(e);return this.db.getTargetCache().getTargetCount(e).next((r=>t.next((s=>r+s))))}gr(e){let t=0;return this.dr(e,(r=>{t++})).next((()=>t))}forEachTarget(e,t){return this.db.getTargetCache().forEachTarget(e,t)}dr(e,t){return this.pr(e,((r,s)=>t(s)))}addReference(e,t,r){return Oa(e,r)}removeReference(e,t,r){return Oa(e,r)}removeTargets(e,t,r){return this.db.getTargetCache().removeTargets(e,t,r)}markPotentiallyOrphaned(e,t){return Oa(e,t)}yr(e,t){return(function(s,i){let o=!1;return sy(s).te((a=>ry(s,a,i).next((u=>(u&&(o=!0),S.resolve(!u)))))).next((()=>o))})(e,t)}removeOrphanedDocuments(e,t){const r=this.db.getRemoteDocumentCache().newChangeBuffer(),s=[];let i=0;return this.pr(e,((o,a)=>{if(a<=t){const u=this.yr(e,o).next((l=>{if(!l)return i++,r.getEntry(e,o).next((()=>(r.removeEntry(o,J.min()),Jn(e).delete((function(f){return[0,ht(f.path)]})(o)))))}));s.push(u)}})).next((()=>S.waitFor(s))).next((()=>r.apply(e))).next((()=>i))}removeTarget(e,t){const r=t.withSequenceNumber(e.currentSequenceNumber);return this.db.getTargetCache().updateTargetData(e,r)}updateLimboDocument(e,t){return Oa(e,t)}pr(e,t){const r=Jn(e);let s,i=gt.ce;return r.ee({index:sh},(([o,a],{path:u,sequenceNumber:l})=>{o===0?(i!==gt.ce&&t(new B(Ht(s)),i),i=l,s=u):i=gt.ce})).next((()=>{i!==gt.ce&&t(new B(Ht(s)),i)}))}getCacheSize(e){return this.db.getRemoteDocumentCache().getSize(e)}}function Oa(n,e){return Jn(n).put((function(r,s){return{targetId:0,path:ht(r.path),sequenceNumber:s}})(e,n.currentSequenceNumber))}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class cy{constructor(){this.changes=new Sn((e=>e.toString()),((e,t)=>e.isEqual(t))),this.changesApplied=!1}addEntry(e){this.assertNotApplied(),this.changes.set(e.key,e)}removeEntry(e,t){this.assertNotApplied(),this.changes.set(e,Ce.newInvalidDocument(e).setReadTime(t))}getEntry(e,t){this.assertNotApplied();const r=this.changes.get(t);return r!==void 0?S.resolve(r):this.getFromCache(e,t)}getEntries(e,t){return this.getAllFromCache(e,t)}apply(e){return this.assertNotApplied(),this.changesApplied=!0,this.applyChanges(e)}assertNotApplied(){}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class PS{constructor(e){this.serializer=e}setIndexManager(e){this.indexManager=e}addEntry(e,t,r){return Or(e).put(r)}removeEntry(e,t,r){return Or(e).delete((function(i,o){const a=i.path.toArray();return[a.slice(0,a.length-2),a[a.length-2],Ic(o),a[a.length-1]]})(t,r))}updateMetadata(e,t){return this.getMetadata(e).next((r=>(r.byteSize+=t,this.wr(e,r))))}getEntry(e,t){let r=Ce.newInvalidDocument(t);return Or(e).ee({index:Wa,range:IDBKeyRange.only(ro(t))},((s,i)=>{r=this.Sr(t,i)})).next((()=>r))}br(e,t){let r={size:0,document:Ce.newInvalidDocument(t)};return Or(e).ee({index:Wa,range:IDBKeyRange.only(ro(t))},((s,i)=>{r={document:this.Sr(t,i),size:Ec(i)}})).next((()=>r))}getEntries(e,t){let r=yt();return this.Dr(e,t,((s,i)=>{const o=this.Sr(s,i);r=r.insert(s,o)})).next((()=>r))}Cr(e,t){let r=yt(),s=new ve(B.comparator);return this.Dr(e,t,((i,o)=>{const a=this.Sr(i,o);r=r.insert(i,a),s=s.insert(i,Ec(o))})).next((()=>({documents:r,vr:s})))}Dr(e,t,r){if(t.isEmpty())return S.resolve();let s=new Ie(Lm);t.forEach((u=>s=s.add(u)));const i=IDBKeyRange.bound(ro(s.first()),ro(s.last())),o=s.getIterator();let a=o.getNext();return Or(e).ee({index:Wa,range:i},((u,l,h)=>{const f=B.fromSegments([...l.prefixPath,l.collectionGroup,l.documentId]);for(;a&&Lm(a,f)<0;)r(a,null),a=o.getNext();a&&a.isEqual(f)&&(r(a,l),a=o.hasNext()?o.getNext():null),a?h.j(ro(a)):h.done()})).next((()=>{for(;a;)r(a,null),a=o.hasNext()?o.getNext():null}))}getDocumentsMatchingQuery(e,t,r,s,i){const o=t.path,a=[o.popLast().toArray(),o.lastSegment(),Ic(r.readTime),r.documentKey.path.isEmpty()?"":r.documentKey.path.lastSegment()],u=[o.popLast().toArray(),o.lastSegment(),[Number.MAX_SAFE_INTEGER,Number.MAX_SAFE_INTEGER],""];return Or(e).J(IDBKeyRange.bound(a,u,!0)).next((l=>{i==null||i.incrementDocumentReadCount(l.length);let h=yt();for(const f of l){const p=this.Sr(B.fromSegments(f.prefixPath.concat(f.collectionGroup,f.documentId)),f);p.isFoundDocument()&&(sa(t,p)||s.has(p.key))&&(h=h.insert(p.key,p))}return h}))}getAllFromCollectionGroup(e,t,r,s){let i=yt();const o=Mm(t,r),a=Mm(t,Pt.max());return Or(e).ee({index:Gg,range:IDBKeyRange.bound(o,a,!0)},((u,l,h)=>{const f=this.Sr(B.fromSegments(l.prefixPath.concat(l.collectionGroup,l.documentId)),l);i=i.insert(f.key,f),i.size===s&&h.done()})).next((()=>i))}newChangeBuffer(e){return new kS(this,!!e&&e.trackRemovals)}getSize(e){return this.getMetadata(e).next((t=>t.byteSize))}getMetadata(e){return xm(e).get(dl).next((t=>(K(!!t,20021),t)))}wr(e,t){return xm(e).put(dl,t)}Sr(e,t){if(t){const r=mS(this.serializer,t);if(!(r.isNoDocument()&&r.version.isEqual(J.min())))return r}return Ce.newInvalidDocument(e)}}function uy(n){return new PS(n)}class kS extends cy{constructor(e,t){super(),this.Fr=e,this.trackRemovals=t,this.Mr=new Sn((r=>r.toString()),((r,s)=>r.isEqual(s)))}applyChanges(e){const t=[];let r=0,s=new Ie(((i,o)=>Z(i.canonicalString(),o.canonicalString())));return this.changes.forEach(((i,o)=>{const a=this.Mr.get(i);if(t.push(this.Fr.removeEntry(e,i,a.readTime)),o.isValidDocument()){const u=ym(this.Fr.serializer,o);s=s.add(i.path.popLast());const l=Ec(u);r+=l-a.size,t.push(this.Fr.addEntry(e,i,u))}else if(r-=a.size,this.trackRemovals){const u=ym(this.Fr.serializer,o.convertToNoDocument(J.min()));t.push(this.Fr.addEntry(e,i,u))}})),s.forEach((i=>{t.push(this.Fr.indexManager.addToCollectionParentIndex(e,i))})),t.push(this.Fr.updateMetadata(e,r)),S.waitFor(t)}getFromCache(e,t){return this.Fr.br(e,t).next((r=>(this.Mr.set(t,{size:r.size,readTime:r.document.readTime}),r.document)))}getAllFromCache(e,t){return this.Fr.Cr(e,t).next((({documents:r,vr:s})=>(s.forEach(((i,o)=>{this.Mr.set(i,{size:o,readTime:r.get(i).readTime})})),r)))}}function xm(n){return Ze(n,Vo)}function Or(n){return Ze(n,fc)}function ro(n){const e=n.path.toArray();return[e.slice(0,e.length-2),e[e.length-2],e[e.length-1]]}function Mm(n,e){const t=e.documentKey.path.toArray();return[n,Ic(e.readTime),t.slice(0,t.length-2),t.length>0?t[t.length-1]:""]}function Lm(n,e){const t=n.path.toArray(),r=e.path.toArray();let s=0;for(let i=0;i<t.length-2&&i<r.length-2;++i)if(s=Z(t[i],r[i]),s)return s;return s=Z(t.length,r.length),s||(s=Z(t[t.length-2],r[r.length-2]),s||Z(t[t.length-1],r[r.length-1]))}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class CS{constructor(e,t){this.overlayedDocument=e,this.mutatedFields=t}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ly{constructor(e,t,r,s){this.remoteDocumentCache=e,this.mutationQueue=t,this.documentOverlayCache=r,this.indexManager=s}getDocument(e,t){let r=null;return this.documentOverlayCache.getOverlay(e,t).next((s=>(r=s,this.remoteDocumentCache.getEntry(e,t)))).next((s=>(r!==null&&To(r.mutation,s,_t.empty(),_e.now()),s)))}getDocuments(e,t){return this.remoteDocumentCache.getEntries(e,t).next((r=>this.getLocalViewOfDocuments(e,r,re()).next((()=>r))))}getLocalViewOfDocuments(e,t,r=re()){const s=Qt();return this.populateOverlays(e,s,t).next((()=>this.computeViews(e,t,s,r).next((i=>{let o=ho();return i.forEach(((a,u)=>{o=o.insert(a,u.overlayedDocument)})),o}))))}getOverlayedDocuments(e,t){const r=Qt();return this.populateOverlays(e,r,t).next((()=>this.computeViews(e,t,r,re())))}populateOverlays(e,t,r){const s=[];return r.forEach((i=>{t.has(i)||s.push(i)})),this.documentOverlayCache.getOverlays(e,s).next((i=>{i.forEach(((o,a)=>{t.set(o,a)}))}))}computeViews(e,t,r,s){let i=yt();const o=Eo(),a=(function(){return Eo()})();return t.forEach(((u,l)=>{const h=r.get(l.key);s.has(l.key)&&(h===void 0||h.mutation instanceof Rn)?i=i.insert(l.key,l):h!==void 0?(o.set(l.key,h.mutation.getFieldMask()),To(h.mutation,l,h.mutation.getFieldMask(),_e.now())):o.set(l.key,_t.empty())})),this.recalculateAndSaveOverlays(e,i).next((u=>(u.forEach(((l,h)=>o.set(l,h))),t.forEach(((l,h)=>a.set(l,new CS(h,o.get(l)??null)))),a)))}recalculateAndSaveOverlays(e,t){const r=Eo();let s=new ve(((o,a)=>o-a)),i=re();return this.mutationQueue.getAllMutationBatchesAffectingDocumentKeys(e,t).next((o=>{for(const a of o)a.keys().forEach((u=>{const l=t.get(u);if(l===null)return;let h=r.get(u)||_t.empty();h=a.applyToLocalView(l,h),r.set(u,h);const f=(s.get(a.batchId)||re()).add(u);s=s.insert(a.batchId,f)}))})).next((()=>{const o=[],a=s.getReverseIterator();for(;a.hasNext();){const u=a.getNext(),l=u.key,h=u.value,f=S_();h.forEach((p=>{if(!i.has(p)){const _=N_(t.get(p),r.get(p));_!==null&&f.set(p,_),i=i.add(p)}})),o.push(this.documentOverlayCache.saveOverlays(e,l,f))}return S.waitFor(o)})).next((()=>r))}recalculateAndSaveOverlaysForDocumentKeys(e,t){return this.remoteDocumentCache.getEntries(e,t).next((r=>this.recalculateAndSaveOverlays(e,r)))}getDocumentsMatchingQuery(e,t,r,s){return Mb(t)?this.getDocumentsMatchingDocumentQuery(e,t.path):hh(t)?this.getDocumentsMatchingCollectionGroupQuery(e,t,r,s):this.getDocumentsMatchingCollectionQuery(e,t,r,s)}getNextDocuments(e,t,r,s){return this.remoteDocumentCache.getAllFromCollectionGroup(e,t,r,s).next((i=>{const o=s-i.size>0?this.documentOverlayCache.getOverlaysForCollectionGroup(e,t,r.largestBatchId,s-i.size):S.resolve(Qt());let a=Ks,u=i;return o.next((l=>S.forEach(l,((h,f)=>(a<f.largestBatchId&&(a=f.largestBatchId),i.get(h)?S.resolve():this.remoteDocumentCache.getEntry(e,h).next((p=>{u=u.insert(h,p)}))))).next((()=>this.populateOverlays(e,l,i))).next((()=>this.computeViews(e,u,l,re()))).next((h=>({batchId:a,changes:b_(h)})))))}))}getDocumentsMatchingDocumentQuery(e,t){return this.getDocument(e,new B(t)).next((r=>{let s=ho();return r.isFoundDocument()&&(s=s.insert(r.key,r)),s}))}getDocumentsMatchingCollectionGroupQuery(e,t,r,s){const i=t.collectionGroup;let o=ho();return this.indexManager.getCollectionParents(e,i).next((a=>S.forEach(a,(u=>{const l=(function(f,p){return new bn(p,null,f.explicitOrderBy.slice(),f.filters.slice(),f.limit,f.limitType,f.startAt,f.endAt)})(t,u.child(i));return this.getDocumentsMatchingCollectionQuery(e,l,r,s).next((h=>{h.forEach(((f,p)=>{o=o.insert(f,p)}))}))})).next((()=>o))))}getDocumentsMatchingCollectionQuery(e,t,r,s){let i;return this.documentOverlayCache.getOverlaysForCollection(e,t.path,r.largestBatchId).next((o=>(i=o,this.remoteDocumentCache.getDocumentsMatchingQuery(e,t,r,i,s)))).next((o=>{i.forEach(((u,l)=>{const h=l.getKey();o.get(h)===null&&(o=o.insert(h,Ce.newInvalidDocument(h)))}));let a=ho();return o.forEach(((u,l)=>{const h=i.get(u);h!==void 0&&To(h.mutation,l,_t.empty(),_e.now()),sa(t,l)&&(a=a.insert(u,l))})),a}))}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class NS{constructor(e){this.serializer=e,this.Or=new Map,this.Nr=new Map}getBundleMetadata(e,t){return S.resolve(this.Or.get(t))}saveBundleMetadata(e,t){return this.Or.set(t.id,(function(s){return{id:s.id,version:s.version,createTime:je(s.createTime)}})(t)),S.resolve()}getNamedQuery(e,t){return S.resolve(this.Nr.get(t))}saveNamedQuery(e,t){return this.Nr.set(t.name,(function(s){return{name:s.name,query:Xc(s.bundledQuery),readTime:je(s.readTime)}})(t)),S.resolve()}}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class DS{constructor(){this.overlays=new ve(B.comparator),this.Br=new Map}getOverlay(e,t){return S.resolve(this.overlays.get(t))}getOverlays(e,t){const r=Qt();return S.forEach(t,(s=>this.getOverlay(e,s).next((i=>{i!==null&&r.set(s,i)})))).next((()=>r))}saveOverlays(e,t,r){return r.forEach(((s,i)=>{this.wt(e,t,i)})),S.resolve()}removeOverlaysForBatchId(e,t,r){const s=this.Br.get(r);return s!==void 0&&(s.forEach((i=>this.overlays=this.overlays.remove(i))),this.Br.delete(r)),S.resolve()}getOverlaysForCollection(e,t,r){const s=Qt(),i=t.length+1,o=new B(t.child("")),a=this.overlays.getIteratorFrom(o);for(;a.hasNext();){const u=a.getNext().value,l=u.getKey();if(!t.isPrefixOf(l.path))break;l.path.length===i&&u.largestBatchId>r&&s.set(u.getKey(),u)}return S.resolve(s)}getOverlaysForCollectionGroup(e,t,r,s){let i=new ve(((l,h)=>l-h));const o=this.overlays.getIterator();for(;o.hasNext();){const l=o.getNext().value;if(l.getKey().getCollectionGroup()===t&&l.largestBatchId>r){let h=i.get(l.largestBatchId);h===null&&(h=Qt(),i=i.insert(l.largestBatchId,h)),h.set(l.getKey(),l)}}const a=Qt(),u=i.getIterator();for(;u.hasNext()&&(u.getNext().value.forEach(((l,h)=>a.set(l,h))),!(a.size()>=s)););return S.resolve(a)}wt(e,t,r){const s=this.overlays.get(r.key);if(s!==null){const o=this.Br.get(s.largestBatchId).delete(r.key);this.Br.set(s.largestBatchId,o)}this.overlays=this.overlays.insert(r.key,new yh(t,r));let i=this.Br.get(t);i===void 0&&(i=re(),this.Br.set(t,i)),this.Br.set(t,i.add(r.key))}}/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class VS{constructor(){this.sessionToken=Fe.EMPTY_BYTE_STRING}getSessionToken(e){return S.resolve(this.sessionToken)}setSessionToken(e,t){return this.sessionToken=t,S.resolve()}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Ah{constructor(){this.Lr=new Ie(tt.kr),this.qr=new Ie(tt.Kr)}isEmpty(){return this.Lr.isEmpty()}addReference(e,t){const r=new tt(e,t);this.Lr=this.Lr.add(r),this.qr=this.qr.add(r)}Ur(e,t){e.forEach((r=>this.addReference(r,t)))}removeReference(e,t){this.$r(new tt(e,t))}Wr(e,t){e.forEach((r=>this.removeReference(r,t)))}Qr(e){const t=new B(new oe([])),r=new tt(t,e),s=new tt(t,e+1),i=[];return this.qr.forEachInRange([r,s],(o=>{this.$r(o),i.push(o.key)})),i}Gr(){this.Lr.forEach((e=>this.$r(e)))}$r(e){this.Lr=this.Lr.delete(e),this.qr=this.qr.delete(e)}zr(e){const t=new B(new oe([])),r=new tt(t,e),s=new tt(t,e+1);let i=re();return this.qr.forEachInRange([r,s],(o=>{i=i.add(o.key)})),i}containsKey(e){const t=new tt(e,0),r=this.Lr.firstAfterOrEqual(t);return r!==null&&e.isEqual(r.key)}}class tt{constructor(e,t){this.key=e,this.jr=t}static kr(e,t){return B.comparator(e.key,t.key)||Z(e.jr,t.jr)}static Kr(e,t){return Z(e.jr,t.jr)||B.comparator(e.key,t.key)}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class OS{constructor(e,t){this.indexManager=e,this.referenceDelegate=t,this.mutationQueue=[],this.Xn=1,this.Jr=new Ie(tt.kr)}checkEmpty(e){return S.resolve(this.mutationQueue.length===0)}addMutationBatch(e,t,r,s){const i=this.Xn;this.Xn++,this.mutationQueue.length>0&&this.mutationQueue[this.mutationQueue.length-1];const o=new gh(i,t,r,s);this.mutationQueue.push(o);for(const a of s)this.Jr=this.Jr.add(new tt(a.key,i)),this.indexManager.addToCollectionParentIndex(e,a.key.path.popLast());return S.resolve(o)}lookupMutationBatch(e,t){return S.resolve(this.Hr(t))}getNextMutationBatchAfterBatchId(e,t){const r=t+1,s=this.Zr(r),i=s<0?0:s;return S.resolve(this.mutationQueue.length>i?this.mutationQueue[i]:null)}getHighestUnacknowledgedBatchId(){return S.resolve(this.mutationQueue.length===0?or:this.Xn-1)}getAllMutationBatches(e){return S.resolve(this.mutationQueue.slice())}getAllMutationBatchesAffectingDocumentKey(e,t){const r=new tt(t,0),s=new tt(t,Number.POSITIVE_INFINITY),i=[];return this.Jr.forEachInRange([r,s],(o=>{const a=this.Hr(o.jr);i.push(a)})),S.resolve(i)}getAllMutationBatchesAffectingDocumentKeys(e,t){let r=new Ie(Z);return t.forEach((s=>{const i=new tt(s,0),o=new tt(s,Number.POSITIVE_INFINITY);this.Jr.forEachInRange([i,o],(a=>{r=r.add(a.jr)}))})),S.resolve(this.Xr(r))}getAllMutationBatchesAffectingQuery(e,t){const r=t.path,s=r.length+1;let i=r;B.isDocumentKey(i)||(i=i.child(""));const o=new tt(new B(i),0);let a=new Ie(Z);return this.Jr.forEachWhile((u=>{const l=u.key.path;return!!r.isPrefixOf(l)&&(l.length===s&&(a=a.add(u.jr)),!0)}),o),S.resolve(this.Xr(a))}Xr(e){const t=[];return e.forEach((r=>{const s=this.Hr(r);s!==null&&t.push(s)})),t}removeMutationBatch(e,t){K(this.Yr(t.batchId,"removed")===0,55003),this.mutationQueue.shift();let r=this.Jr;return S.forEach(t.mutations,(s=>{const i=new tt(s.key,t.batchId);return r=r.delete(i),this.referenceDelegate.markPotentiallyOrphaned(e,s.key)})).next((()=>{this.Jr=r}))}tr(e){}containsKey(e,t){const r=new tt(t,0),s=this.Jr.firstAfterOrEqual(r);return S.resolve(t.isEqual(s&&s.key))}performConsistencyCheck(e){return this.mutationQueue.length,S.resolve()}Yr(e,t){return this.Zr(e)}Zr(e){return this.mutationQueue.length===0?0:e-this.mutationQueue[0].batchId}Hr(e){const t=this.Zr(e);return t<0||t>=this.mutationQueue.length?null:this.mutationQueue[t]}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class xS{constructor(e){this.ei=e,this.docs=(function(){return new ve(B.comparator)})(),this.size=0}setIndexManager(e){this.indexManager=e}addEntry(e,t){const r=t.key,s=this.docs.get(r),i=s?s.size:0,o=this.ei(t);return this.docs=this.docs.insert(r,{document:t.mutableCopy(),size:o}),this.size+=o-i,this.indexManager.addToCollectionParentIndex(e,r.path.popLast())}removeEntry(e){const t=this.docs.get(e);t&&(this.docs=this.docs.remove(e),this.size-=t.size)}getEntry(e,t){const r=this.docs.get(t);return S.resolve(r?r.document.mutableCopy():Ce.newInvalidDocument(t))}getEntries(e,t){let r=yt();return t.forEach((s=>{const i=this.docs.get(s);r=r.insert(s,i?i.document.mutableCopy():Ce.newInvalidDocument(s))})),S.resolve(r)}getDocumentsMatchingQuery(e,t,r,s){let i=yt();const o=t.path,a=new B(o.child("__id-9223372036854775808__")),u=this.docs.getIteratorFrom(a);for(;u.hasNext();){const{key:l,value:{document:h}}=u.getNext();if(!o.isPrefixOf(l.path))break;l.path.length>o.length+1||nh(Bg(h),r)<=0||(s.has(h.key)||sa(t,h))&&(i=i.insert(h.key,h.mutableCopy()))}return S.resolve(i)}getAllFromCollectionGroup(e,t,r,s){j(9500)}ti(e,t){return S.forEach(this.docs,(r=>t(r)))}newChangeBuffer(e){return new MS(this)}getSize(e){return S.resolve(this.size)}}class MS extends cy{constructor(e){super(),this.Fr=e}applyChanges(e){const t=[];return this.changes.forEach(((r,s)=>{s.isValidDocument()?t.push(this.Fr.addEntry(e,s)):this.Fr.removeEntry(r)})),S.waitFor(t)}getFromCache(e,t){return this.Fr.getEntry(e,t)}getAllFromCache(e,t){return this.Fr.getEntries(e,t)}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class LS{constructor(e){this.persistence=e,this.ni=new Sn((t=>Yr(t)),na),this.lastRemoteSnapshotVersion=J.min(),this.highestTargetId=0,this.ri=0,this.ii=new Ah,this.targetCount=0,this.si=En.sr()}forEachTarget(e,t){return this.ni.forEach(((r,s)=>t(s))),S.resolve()}getLastRemoteSnapshotVersion(e){return S.resolve(this.lastRemoteSnapshotVersion)}getHighestSequenceNumber(e){return S.resolve(this.ri)}allocateTargetId(e){return this.highestTargetId=this.si.next(),S.resolve(this.highestTargetId)}setTargetsMetadata(e,t,r){return r&&(this.lastRemoteSnapshotVersion=r),t>this.ri&&(this.ri=t),S.resolve()}cr(e){this.ni.set(e.target,e);const t=e.targetId;t>this.highestTargetId&&(this.si=new En(t),this.highestTargetId=t),e.sequenceNumber>this.ri&&(this.ri=e.sequenceNumber)}addTargetData(e,t){return this.cr(t),this.targetCount+=1,S.resolve()}updateTargetData(e,t){return this.cr(t),S.resolve()}removeTargetData(e,t){return this.ni.delete(t.target),this.ii.Qr(t.targetId),this.targetCount-=1,S.resolve()}removeTargets(e,t,r){let s=0;const i=[];return this.ni.forEach(((o,a)=>{a.sequenceNumber<=t&&r.get(a.targetId)===null&&(this.ni.delete(o),i.push(this.removeMatchingKeysForTargetId(e,a.targetId)),s++)})),S.waitFor(i).next((()=>s))}getTargetCount(e){return S.resolve(this.targetCount)}getTargetData(e,t){const r=this.ni.get(t)||null;return S.resolve(r)}addMatchingKeys(e,t,r){return this.ii.Ur(t,r),S.resolve()}removeMatchingKeys(e,t,r){this.ii.Wr(t,r);const s=this.persistence.referenceDelegate,i=[];return s&&t.forEach((o=>{i.push(s.markPotentiallyOrphaned(e,o))})),S.waitFor(i)}removeMatchingKeysForTargetId(e,t){return this.ii.Qr(t),S.resolve()}getMatchingKeysForTargetId(e,t){const r=this.ii.zr(t);return S.resolve(r)}containsKey(e,t){return S.resolve(this.ii.containsKey(t))}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class vh{constructor(e,t){this.oi={},this.overlays={},this._i=new gt(0),this.ai=!1,this.ai=!0,this.ui=new VS,this.referenceDelegate=e(this),this.ci=new LS(this),this.indexManager=new TS,this.remoteDocumentCache=(function(s){return new xS(s)})((r=>this.referenceDelegate.li(r))),this.serializer=new Y_(t),this.hi=new NS(this.serializer)}start(){return Promise.resolve()}shutdown(){return this.ai=!1,Promise.resolve()}get started(){return this.ai}setDatabaseDeletedListener(){}setNetworkEnabled(){}getIndexManager(e){return this.indexManager}getDocumentOverlayCache(e){let t=this.overlays[e.toKey()];return t||(t=new DS,this.overlays[e.toKey()]=t),t}getMutationQueue(e,t){let r=this.oi[e.toKey()];return r||(r=new OS(t,this.referenceDelegate),this.oi[e.toKey()]=r),r}getGlobalsCache(){return this.ui}getTargetCache(){return this.ci}getRemoteDocumentCache(){return this.remoteDocumentCache}getBundleCache(){return this.hi}runTransaction(e,t,r){x("MemoryPersistence","Starting transaction:",e);const s=new BS(this._i.next());return this.referenceDelegate.Pi(),r(s).next((i=>this.referenceDelegate.Ti(s).next((()=>i)))).toPromise().then((i=>(s.raiseOnCommittedEvent(),i)))}Ii(e,t){return S.or(Object.values(this.oi).map((r=>()=>r.containsKey(e,t))))}}class BS extends Ug{constructor(e){super(),this.currentSequenceNumber=e}}class tu{constructor(e){this.persistence=e,this.Ei=new Ah,this.Ri=null}static Ai(e){return new tu(e)}get Vi(){if(this.Ri)return this.Ri;throw j(60996)}addReference(e,t,r){return this.Ei.addReference(r,t),this.Vi.delete(r.toString()),S.resolve()}removeReference(e,t,r){return this.Ei.removeReference(r,t),this.Vi.add(r.toString()),S.resolve()}markPotentiallyOrphaned(e,t){return this.Vi.add(t.toString()),S.resolve()}removeTarget(e,t){this.Ei.Qr(t.targetId).forEach((s=>this.Vi.add(s.toString())));const r=this.persistence.getTargetCache();return r.getMatchingKeysForTargetId(e,t.targetId).next((s=>{s.forEach((i=>this.Vi.add(i.toString())))})).next((()=>r.removeTargetData(e,t)))}Pi(){this.Ri=new Set}Ti(e){const t=this.persistence.getRemoteDocumentCache().newChangeBuffer();return S.forEach(this.Vi,(r=>{const s=B.fromPath(r);return this.di(e,s).next((i=>{i||t.removeEntry(s,J.min())}))})).next((()=>(this.Ri=null,t.apply(e))))}updateLimboDocument(e,t){return this.di(e,t).next((r=>{r?this.Vi.delete(t.toString()):this.Vi.add(t.toString())}))}li(e){return 0}di(e,t){return S.or([()=>S.resolve(this.Ei.containsKey(t)),()=>this.persistence.getTargetCache().containsKey(e,t),()=>this.persistence.Ii(e,t)])}}class Tc{constructor(e,t){this.persistence=e,this.mi=new Sn((r=>ht(r.path)),((r,s)=>r.isEqual(s))),this.garbageCollector=ay(this,t)}static Ai(e,t){return new Tc(e,t)}Pi(){}Ti(e){return S.resolve()}forEachTarget(e,t){return this.persistence.getTargetCache().forEachTarget(e,t)}Vr(e){const t=this.gr(e);return this.persistence.getTargetCache().getTargetCount(e).next((r=>t.next((s=>r+s))))}gr(e){let t=0;return this.dr(e,(r=>{t++})).next((()=>t))}dr(e,t){return S.forEach(this.mi,((r,s)=>this.yr(e,r,s).next((i=>i?S.resolve():t(s)))))}removeTargets(e,t,r){return this.persistence.getTargetCache().removeTargets(e,t,r)}removeOrphanedDocuments(e,t){let r=0;const s=this.persistence.getRemoteDocumentCache(),i=s.newChangeBuffer();return s.ti(e,(o=>this.yr(e,o,t).next((a=>{a||(r++,i.removeEntry(o,J.min()))})))).next((()=>i.apply(e))).next((()=>r))}markPotentiallyOrphaned(e,t){return this.mi.set(t,e.currentSequenceNumber),S.resolve()}removeTarget(e,t){const r=t.withSequenceNumber(e.currentSequenceNumber);return this.persistence.getTargetCache().updateTargetData(e,r)}addReference(e,t,r){return this.mi.set(r,e.currentSequenceNumber),S.resolve()}removeReference(e,t,r){return this.mi.set(r,e.currentSequenceNumber),S.resolve()}updateLimboDocument(e,t){return this.mi.set(t,e.currentSequenceNumber),S.resolve()}li(e){let t=e.key.toString().length;return e.isFoundDocument()&&(t+=Qa(e.data.value)),t}yr(e,t,r){return S.or([()=>this.persistence.Ii(e,t),()=>this.persistence.getTargetCache().containsKey(e,t),()=>{const s=this.mi.get(t);return S.resolve(s!==void 0&&s>r)}])}getCacheSize(e){return this.persistence.getRemoteDocumentCache().getSize(e)}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class FS{constructor(e){this.serializer=e}k(e,t,r,s){const i=new Fc("createOrUpgrade",t);r<1&&s>=1&&((function(u){u.createObjectStore(ta)})(e),(function(u){u.createObjectStore(Do,{keyPath:Xv}),u.createObjectStore(Ot,{keyPath:Hf,autoIncrement:!0}).createIndex(qr,Qf,{unique:!0}),u.createObjectStore(Qs)})(e),Bm(e),(function(u){u.createObjectStore(Lr)})(e));let o=S.resolve();return r<3&&s>=3&&(r!==0&&((function(u){u.deleteObjectStore(Ys),u.deleteObjectStore(Js),u.deleteObjectStore(Gr)})(e),Bm(e)),o=o.next((()=>(function(u){const l=u.store(Gr),h={highestTargetId:0,highestListenSequenceNumber:0,lastRemoteSnapshotVersion:J.min().toTimestamp(),targetCount:0};return l.put(mc,h)})(i)))),r<4&&s>=4&&(r!==0&&(o=o.next((()=>(function(u,l){return l.store(Ot).J().next((f=>{u.deleteObjectStore(Ot),u.createObjectStore(Ot,{keyPath:Hf,autoIncrement:!0}).createIndex(qr,Qf,{unique:!0});const p=l.store(Ot),_=f.map((w=>p.put(w)));return S.waitFor(_)}))})(e,i)))),o=o.next((()=>{(function(u){u.createObjectStore(Xs,{keyPath:ab})})(e)}))),r<5&&s>=5&&(o=o.next((()=>this.fi(i)))),r<6&&s>=6&&(o=o.next((()=>((function(u){u.createObjectStore(Vo)})(e),this.gi(i))))),r<7&&s>=7&&(o=o.next((()=>this.pi(i)))),r<8&&s>=8&&(o=o.next((()=>this.yi(e,i)))),r<9&&s>=9&&(o=o.next((()=>{(function(u){u.objectStoreNames.contains("remoteDocumentChanges")&&u.deleteObjectStore("remoteDocumentChanges")})(e)}))),r<10&&s>=10&&(o=o.next((()=>this.wi(i)))),r<11&&s>=11&&(o=o.next((()=>{(function(u){u.createObjectStore(Uc,{keyPath:cb})})(e),(function(u){u.createObjectStore($c,{keyPath:ub})})(e)}))),r<12&&s>=12&&(o=o.next((()=>{(function(u){const l=u.createObjectStore(qc,{keyPath:gb});l.createIndex(ml,_b,{unique:!1}),l.createIndex(Hg,yb,{unique:!1})})(e)}))),r<13&&s>=13&&(o=o.next((()=>(function(u){const l=u.createObjectStore(fc,{keyPath:eb});l.createIndex(Wa,tb),l.createIndex(Gg,nb)})(e))).next((()=>this.Si(e,i))).next((()=>e.deleteObjectStore(Lr)))),r<14&&s>=14&&(o=o.next((()=>this.bi(e,i)))),r<15&&s>=15&&(o=o.next((()=>(function(u){u.createObjectStore(ih,{keyPath:lb,autoIncrement:!0}).createIndex(fl,hb,{unique:!1}),u.createObjectStore(yo,{keyPath:db}).createIndex(Kg,fb,{unique:!1}),u.createObjectStore(Io,{keyPath:mb}).createIndex(Wg,pb,{unique:!1})})(e)))),r<16&&s>=16&&(o=o.next((()=>{t.objectStore(yo).clear()})).next((()=>{t.objectStore(Io).clear()}))),r<17&&s>=17&&(o=o.next((()=>{(function(u){u.createObjectStore(oh,{keyPath:Ib})})(e)}))),r<18&&s>=18&&Fp()&&(o=o.next((()=>{t.objectStore(yo).clear()})).next((()=>{t.objectStore(Io).clear()}))),o}gi(e){let t=0;return e.store(Lr).ee(((r,s)=>{t+=Ec(s)})).next((()=>{const r={byteSize:t};return e.store(Vo).put(dl,r)}))}fi(e){const t=e.store(Do),r=e.store(Ot);return t.J().next((s=>S.forEach(s,(i=>{const o=IDBKeyRange.bound([i.userId,or],[i.userId,i.lastAcknowledgedBatchId]);return r.J(qr,o).next((a=>S.forEach(a,(u=>{K(u.userId===i.userId,18650,"Cannot process batch from unexpected user",{batchId:u.batchId});const l=Fr(this.serializer,u);return ny(e,i.userId,l).next((()=>{}))}))))}))))}pi(e){const t=e.store(Ys),r=e.store(Lr);return e.store(Gr).get(mc).next((s=>{const i=[];return r.ee(((o,a)=>{const u=new oe(o),l=(function(f){return[0,ht(f)]})(u);i.push(t.get(l).next((h=>h?S.resolve():(f=>t.put({targetId:0,path:ht(f),sequenceNumber:s.highestListenSequenceNumber}))(u))))})).next((()=>S.waitFor(i)))}))}yi(e,t){e.createObjectStore(Oo,{keyPath:ob});const r=t.store(Oo),s=new Th,i=o=>{if(s.add(o)){const a=o.lastSegment(),u=o.popLast();return r.put({collectionId:a,parent:ht(u)})}};return t.store(Lr).ee({Y:!0},((o,a)=>{const u=new oe(o);return i(u.popLast())})).next((()=>t.store(Qs).ee({Y:!0},(([o,a,u],l)=>{const h=Ht(a);return i(h.popLast())}))))}wi(e){const t=e.store(Js);return t.ee(((r,s)=>{const i=mo(s),o=X_(this.serializer,i);return t.put(o)}))}Si(e,t){const r=t.store(Lr),s=[];return r.ee(((i,o)=>{const a=t.store(fc),u=(function(f){return f.document?new B(oe.fromString(f.document.name).popFirst(5)):f.noDocument?B.fromSegments(f.noDocument.path):f.unknownDocument?B.fromSegments(f.unknownDocument.path):j(36783)})(o).path.toArray(),l={prefixPath:u.slice(0,u.length-2),collectionGroup:u[u.length-2],documentId:u[u.length-1],readTime:o.readTime||[0,0],unknownDocument:o.unknownDocument,noDocument:o.noDocument,document:o.document,hasCommittedMutations:!!o.hasCommittedMutations};s.push(a.put(l))})).next((()=>S.waitFor(s)))}bi(e,t){const r=t.store(Ot),s=uy(this.serializer),i=new vh(tu.Ai,this.serializer.gt);return r.J().next((o=>{const a=new Map;return o.forEach((u=>{let l=a.get(u.userId)??re();Fr(this.serializer,u).keys().forEach((h=>l=l.add(h))),a.set(u.userId,l)})),S.forEach(a,((u,l)=>{const h=new nt(l),f=Zc.yt(this.serializer,h),p=i.getIndexManager(h),_=eu.yt(h,this.serializer,p,i.referenceDelegate);return new ly(s,_,f,p).recalculateAndSaveOverlaysForDocumentKeys(new pl(t,gt.ce),u).next()}))}))}}function Bm(n){n.createObjectStore(Ys,{keyPath:sb}).createIndex(sh,ib,{unique:!0}),n.createObjectStore(Js,{keyPath:"targetId"}).createIndex(zg,rb,{unique:!0}),n.createObjectStore(Gr)}const Gn="IndexedDbPersistence",$u=18e5,qu=5e3,ju="Failed to obtain exclusive access to the persistence layer. To allow shared access, multi-tab synchronization has to be enabled in all tabs. If you are using `experimentalForceOwningTab:true`, make sure that only one tab has persistence enabled at any given time.",hy="main";class bh{constructor(e,t,r,s,i,o,a,u,l,h,f=18){if(this.allowTabSynchronization=e,this.persistenceKey=t,this.clientId=r,this.Di=i,this.window=o,this.document=a,this.Ci=l,this.Fi=h,this.Mi=f,this._i=null,this.ai=!1,this.isPrimary=!1,this.networkEnabled=!0,this.xi=null,this.inForeground=!1,this.Oi=null,this.Ni=null,this.Bi=Number.NEGATIVE_INFINITY,this.Li=p=>Promise.resolve(),!bh.v())throw new D(k.UNIMPLEMENTED,"This platform is either missing IndexedDB or is known to have an incomplete implementation. Offline persistence has been disabled.");this.referenceDelegate=new RS(this,s),this.ki=t+hy,this.serializer=new Y_(u),this.qi=new tn(this.ki,this.Mi,new FS(this.serializer)),this.ui=new gS,this.ci=new vS(this.referenceDelegate,this.serializer),this.remoteDocumentCache=uy(this.serializer),this.hi=new pS,this.window&&this.window.localStorage?this.Ki=this.window.localStorage:(this.Ki=null,h===!1&&qe(Gn,"LocalStorage is unavailable. As a result, persistence may not work reliably. In particular enablePersistence() could fail immediately after refreshing the page."))}start(){return this.Ui().then((()=>{if(!this.isPrimary&&!this.allowTabSynchronization)throw new D(k.FAILED_PRECONDITION,ju);return this.$i(),this.Wi(),this.Qi(),this.runTransaction("getHighestListenSequenceNumber","readonly",(e=>this.ci.getHighestSequenceNumber(e)))})).then((e=>{this._i=new gt(e,this.Ci)})).then((()=>{this.ai=!0})).catch((e=>(this.qi&&this.qi.close(),Promise.reject(e))))}Gi(e){return this.Li=async t=>{if(this.started)return e(t)},e(this.isPrimary)}setDatabaseDeletedListener(e){this.qi.K((async t=>{t.newVersion===null&&await e()}))}setNetworkEnabled(e){this.networkEnabled!==e&&(this.networkEnabled=e,this.Di.enqueueAndForget((async()=>{this.started&&await this.Ui()})))}Ui(){return this.runTransaction("updateClientMetadataAndTryBecomePrimary","readwrite",(e=>xa(e).put({clientId:this.clientId,updateTimeMs:Date.now(),networkEnabled:this.networkEnabled,inForeground:this.inForeground}).next((()=>{if(this.isPrimary)return this.zi(e).next((t=>{t||(this.isPrimary=!1,this.Di.enqueueRetryable((()=>this.Li(!1))))}))})).next((()=>this.ji(e))).next((t=>this.isPrimary&&!t?this.Ji(e).next((()=>!1)):!!t&&this.Hi(e).next((()=>!0)))))).catch((e=>{if(Ir(e))return x(Gn,"Failed to extend owner lease: ",e),this.isPrimary;if(!this.allowTabSynchronization)throw e;return x(Gn,"Releasing owner lease after error during lease refresh",e),!1})).then((e=>{this.isPrimary!==e&&this.Di.enqueueRetryable((()=>this.Li(e))),this.isPrimary=e}))}zi(e){return so(e).get(vs).next((t=>S.resolve(this.Zi(t))))}Xi(e){return xa(e).delete(this.clientId)}async Yi(){if(this.isPrimary&&!this.es(this.Bi,$u)){this.Bi=Date.now();const e=await this.runTransaction("maybeGarbageCollectMultiClientState","readwrite-primary",(t=>{const r=Ze(t,Xs);return r.J().next((s=>{const i=this.ts(s,$u),o=s.filter((a=>i.indexOf(a)===-1));return S.forEach(o,(a=>r.delete(a.clientId))).next((()=>o))}))})).catch((()=>[]));if(this.Ki)for(const t of e)this.Ki.removeItem(this.ns(t.clientId))}}Qi(){this.Ni=this.Di.enqueueAfterDelay("client_metadata_refresh",4e3,(()=>this.Ui().then((()=>this.Yi())).then((()=>this.Qi()))))}Zi(e){return!!e&&e.ownerId===this.clientId}ji(e){return this.Fi?S.resolve(!0):so(e).get(vs).next((t=>{if(t!==null&&this.es(t.leaseTimestampMs,qu)&&!this.rs(t.ownerId)){if(this.Zi(t)&&this.networkEnabled)return!0;if(!this.Zi(t)){if(!t.allowTabSynchronization)throw new D(k.FAILED_PRECONDITION,ju);return!1}}return!(!this.networkEnabled||!this.inForeground)||xa(e).J().next((r=>this.ts(r,qu).find((s=>{if(this.clientId!==s.clientId){const i=!this.networkEnabled&&s.networkEnabled,o=!this.inForeground&&s.inForeground,a=this.networkEnabled===s.networkEnabled;if(i||o&&a)return!0}return!1}))===void 0))})).next((t=>(this.isPrimary!==t&&x(Gn,`Client ${t?"is":"is not"} eligible for a primary lease.`),t)))}async shutdown(){this.ai=!1,this.ss(),this.Ni&&(this.Ni.cancel(),this.Ni=null),this._s(),this.us(),await this.qi.runTransaction("shutdown","readwrite",[ta,Xs],(e=>{const t=new pl(e,gt.ce);return this.Ji(t).next((()=>this.Xi(t)))})),this.qi.close(),this.cs()}ts(e,t){return e.filter((r=>this.es(r.updateTimeMs,t)&&!this.rs(r.clientId)))}ls(){return this.runTransaction("getActiveClients","readonly",(e=>xa(e).J().next((t=>this.ts(t,$u).map((r=>r.clientId))))))}get started(){return this.ai}getGlobalsCache(){return this.ui}getMutationQueue(e,t){return eu.yt(e,this.serializer,t,this.referenceDelegate)}getTargetCache(){return this.ci}getRemoteDocumentCache(){return this.remoteDocumentCache}getIndexManager(e){return new AS(e,this.serializer.gt.databaseId)}getDocumentOverlayCache(e){return Zc.yt(this.serializer,e)}getBundleCache(){return this.hi}runTransaction(e,t,r){x(Gn,"Starting transaction:",e);const s=t==="readonly"?"readonly":"readwrite",i=(function(u){return u===18?Tb:u===17?Xg:u===16?Eb:u===15?ah:u===14?Yg:u===13?Jg:u===12?wb:u===11?Qg:void j(60245)})(this.Mi);let o;return this.qi.runTransaction(e,s,i,(a=>(o=new pl(a,this._i?this._i.next():gt.ce),t==="readwrite-primary"?this.zi(o).next((u=>!!u||this.ji(o))).next((u=>{if(!u)throw qe(`Failed to obtain primary lease for action '${e}'.`),this.isPrimary=!1,this.Di.enqueueRetryable((()=>this.Li(!1))),new D(k.FAILED_PRECONDITION,Fg);return r(o)})).next((u=>this.Hi(o).next((()=>u)))):this.hs(o).next((()=>r(o)))))).then((a=>(o.raiseOnCommittedEvent(),a)))}hs(e){return so(e).get(vs).next((t=>{if(t!==null&&this.es(t.leaseTimestampMs,qu)&&!this.rs(t.ownerId)&&!this.Zi(t)&&!(this.Fi||this.allowTabSynchronization&&t.allowTabSynchronization))throw new D(k.FAILED_PRECONDITION,ju)}))}Hi(e){const t={ownerId:this.clientId,allowTabSynchronization:this.allowTabSynchronization,leaseTimestampMs:Date.now()};return so(e).put(vs,t)}static v(){return tn.v()}Ji(e){const t=so(e);return t.get(vs).next((r=>this.Zi(r)?(x(Gn,"Releasing primary lease."),t.delete(vs)):S.resolve()))}es(e,t){const r=Date.now();return!(e<r-t)&&(!(e>r)||(qe(`Detected an update time that is in the future: ${e} > ${r}`),!1))}$i(){this.document!==null&&typeof this.document.addEventListener=="function"&&(this.Oi=()=>{this.Di.enqueueAndForget((()=>(this.inForeground=this.document.visibilityState==="visible",this.Ui())))},this.document.addEventListener("visibilitychange",this.Oi),this.inForeground=this.document.visibilityState==="visible")}_s(){this.Oi&&(this.document.removeEventListener("visibilitychange",this.Oi),this.Oi=null)}Wi(){var e;typeof((e=this.window)==null?void 0:e.addEventListener)=="function"&&(this.xi=()=>{this.ss();const t=/(?:Version|Mobile)\/1[456]/;Bp()&&(navigator.appVersion.match(t)||navigator.userAgent.match(t))&&this.Di.enterRestrictedMode(!0),this.Di.enqueueAndForget((()=>this.shutdown()))},this.window.addEventListener("pagehide",this.xi))}us(){this.xi&&(this.window.removeEventListener("pagehide",this.xi),this.xi=null)}rs(e){var t;try{const r=((t=this.Ki)==null?void 0:t.getItem(this.ns(e)))!==null;return x(Gn,`Client '${e}' ${r?"is":"is not"} zombied in LocalStorage`),r}catch(r){return qe(Gn,"Failed to get zombied client id.",r),!1}}ss(){if(this.Ki)try{this.Ki.setItem(this.ns(this.clientId),String(Date.now()))}catch(e){qe("Failed to set zombie client id.",e)}}cs(){if(this.Ki)try{this.Ki.removeItem(this.ns(this.clientId))}catch{}}ns(e){return`firestore_zombie_${this.persistenceKey}_${e}`}}function so(n){return Ze(n,ta)}function xa(n){return Ze(n,Xs)}function Sh(n,e){let t=n.projectId;return n.isDefaultDatabase||(t+="."+n.database),"firestore/"+e+"/"+t+"/"}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Rh{constructor(e,t,r,s){this.targetId=e,this.fromCache=t,this.Ps=r,this.Ts=s}static Is(e,t){let r=re(),s=re();for(const i of t.docChanges)switch(i.type){case 0:r=r.add(i.doc.key);break;case 1:s=s.add(i.doc.key)}return new Rh(e,t.fromCache,r,s)}}/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class US{constructor(){this._documentReadCount=0}get documentReadCount(){return this._documentReadCount}incrementDocumentReadCount(e){this._documentReadCount+=e}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class dy{constructor(){this.Es=!1,this.Rs=!1,this.As=100,this.Vs=(function(){return Bp()?8:$g(Ye())>0?6:4})()}initialize(e,t){this.ds=e,this.indexManager=t,this.Es=!0}getDocumentsMatchingQuery(e,t,r,s){const i={result:null};return this.fs(e,t).next((o=>{i.result=o})).next((()=>{if(!i.result)return this.gs(e,t,s,r).next((o=>{i.result=o}))})).next((()=>{if(i.result)return;const o=new US;return this.ps(e,t,o).next((a=>{if(i.result=a,this.Rs)return this.ys(e,t,o,a.size)}))})).next((()=>i.result))}ys(e,t,r,s){return r.documentReadCount<this.As?(Cs()<=ce.DEBUG&&x("QueryEngine","SDK will not create cache indexes for query:",Ns(t),"since it only creates cache indexes for collection contains","more than or equal to",this.As,"documents"),S.resolve()):(Cs()<=ce.DEBUG&&x("QueryEngine","Query:",Ns(t),"scans",r.documentReadCount,"local documents and returns",s,"documents as results."),r.documentReadCount>this.Vs*s?(Cs()<=ce.DEBUG&&x("QueryEngine","The SDK decides to create cache indexes for query:",Ns(t),"as using cache indexes may help improve performance."),this.indexManager.createTargetIndexes(e,dt(t))):S.resolve())}fs(e,t){if(cm(t))return S.resolve(null);let r=dt(t);return this.indexManager.getIndexType(e,r).next((s=>s===0?null:(t.limit!==null&&s===1&&(t=_c(t,null,"F"),r=dt(t)),this.indexManager.getDocumentsMatchingTarget(e,r).next((i=>{const o=re(...i);return this.ds.getDocuments(e,o).next((a=>this.indexManager.getMinOffset(e,r).next((u=>{const l=this.ws(t,a);return this.Ss(t,l,o,u.readTime)?this.fs(e,_c(t,null,"F")):this.bs(e,l,t,u)}))))})))))}gs(e,t,r,s){return cm(t)||s.isEqual(J.min())?S.resolve(null):this.ds.getDocuments(e,r).next((i=>{const o=this.ws(t,i);return this.Ss(t,o,r,s)?S.resolve(null):(Cs()<=ce.DEBUG&&x("QueryEngine","Re-using previous result from %s to execute query: %s",s.toString(),Ns(t)),this.bs(e,o,t,Lg(s,Ks)).next((a=>a)))}))}ws(e,t){let r=new Ie(A_(e));return t.forEach(((s,i)=>{sa(e,i)&&(r=r.add(i))})),r}Ss(e,t,r,s){if(e.limit===null)return!1;if(r.size!==t.size)return!0;const i=e.limitType==="F"?t.last():t.first();return!!i&&(i.hasPendingWrites||i.version.compareTo(s)>0)}ps(e,t,r){return Cs()<=ce.DEBUG&&x("QueryEngine","Using full collection scan to execute query:",Ns(t)),this.ds.getDocumentsMatchingQuery(e,t,Pt.min(),r)}bs(e,t,r,s){return this.ds.getDocumentsMatchingQuery(e,r,s).next((i=>(t.forEach((o=>{i=i.insert(o.key,o)})),i)))}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Ph="LocalStore",$S=3e8;class qS{constructor(e,t,r,s){this.persistence=e,this.Ds=t,this.serializer=s,this.Cs=new ve(Z),this.vs=new Sn((i=>Yr(i)),na),this.Fs=new Map,this.Ms=e.getRemoteDocumentCache(),this.ci=e.getTargetCache(),this.hi=e.getBundleCache(),this.xs(r)}xs(e){this.documentOverlayCache=this.persistence.getDocumentOverlayCache(e),this.indexManager=this.persistence.getIndexManager(e),this.mutationQueue=this.persistence.getMutationQueue(e,this.indexManager),this.localDocuments=new ly(this.Ms,this.mutationQueue,this.documentOverlayCache,this.indexManager),this.Ms.setIndexManager(this.indexManager),this.Ds.initialize(this.localDocuments,this.indexManager)}collectGarbage(e){return this.persistence.runTransaction("Collect garbage","readwrite-primary",(t=>e.collect(t,this.Cs)))}}function fy(n,e,t,r){return new qS(n,e,t,r)}async function my(n,e){const t=F(n);return await t.persistence.runTransaction("Handle user change","readonly",(r=>{let s;return t.mutationQueue.getAllMutationBatches(r).next((i=>(s=i,t.xs(e),t.mutationQueue.getAllMutationBatches(r)))).next((i=>{const o=[],a=[];let u=re();for(const l of s){o.push(l.batchId);for(const h of l.mutations)u=u.add(h.key)}for(const l of i){a.push(l.batchId);for(const h of l.mutations)u=u.add(h.key)}return t.localDocuments.getDocuments(r,u).next((l=>({Os:l,removedBatchIds:o,addedBatchIds:a})))}))}))}function jS(n,e){const t=F(n);return t.persistence.runTransaction("Acknowledge batch","readwrite-primary",(r=>{const s=e.batch.keys(),i=t.Ms.newChangeBuffer({trackRemovals:!0});return(function(a,u,l,h){const f=l.batch,p=f.keys();let _=S.resolve();return p.forEach((w=>{_=_.next((()=>h.getEntry(u,w))).next((b=>{const C=l.docVersions.get(w);K(C!==null,48541),b.version.compareTo(C)<0&&(f.applyToRemoteDocument(b,l),b.isValidDocument()&&(b.setReadTime(l.commitVersion),h.addEntry(b)))}))})),_.next((()=>a.mutationQueue.removeMutationBatch(u,f)))})(t,r,e,i).next((()=>i.apply(r))).next((()=>t.mutationQueue.performConsistencyCheck(r))).next((()=>t.documentOverlayCache.removeOverlaysForBatchId(r,s,e.batch.batchId))).next((()=>t.localDocuments.recalculateAndSaveOverlaysForDocumentKeys(r,(function(a){let u=re();for(let l=0;l<a.mutationResults.length;++l)a.mutationResults[l].transformResults.length>0&&(u=u.add(a.batch.mutations[l].key));return u})(e)))).next((()=>t.localDocuments.getDocuments(r,s)))}))}function py(n){const e=F(n);return e.persistence.runTransaction("Get last remote snapshot version","readonly",(t=>e.ci.getLastRemoteSnapshotVersion(t)))}function GS(n,e){const t=F(n),r=e.snapshotVersion;let s=t.Cs;return t.persistence.runTransaction("Apply remote event","readwrite-primary",(i=>{const o=t.Ms.newChangeBuffer({trackRemovals:!0});s=t.Cs;const a=[];e.targetChanges.forEach(((h,f)=>{const p=s.get(f);if(!p)return;a.push(t.ci.removeMatchingKeys(i,h.removedDocuments,f).next((()=>t.ci.addMatchingKeys(i,h.addedDocuments,f))));let _=p.withSequenceNumber(i.currentSequenceNumber);e.targetMismatches.get(f)!==null?_=_.withResumeToken(Fe.EMPTY_BYTE_STRING,J.min()).withLastLimboFreeSnapshotVersion(J.min()):h.resumeToken.approximateByteSize()>0&&(_=_.withResumeToken(h.resumeToken,r)),s=s.insert(f,_),(function(b,C,V){return b.resumeToken.approximateByteSize()===0||C.snapshotVersion.toMicroseconds()-b.snapshotVersion.toMicroseconds()>=$S?!0:V.addedDocuments.size+V.modifiedDocuments.size+V.removedDocuments.size>0})(p,_,h)&&a.push(t.ci.updateTargetData(i,_))}));let u=yt(),l=re();if(e.documentUpdates.forEach((h=>{e.resolvedLimboDocuments.has(h)&&a.push(t.persistence.referenceDelegate.updateLimboDocument(i,h))})),a.push(gy(i,o,e.documentUpdates).next((h=>{u=h.Ns,l=h.Bs}))),!r.isEqual(J.min())){const h=t.ci.getLastRemoteSnapshotVersion(i).next((f=>t.ci.setTargetsMetadata(i,i.currentSequenceNumber,r)));a.push(h)}return S.waitFor(a).next((()=>o.apply(i))).next((()=>t.localDocuments.getLocalViewOfDocuments(i,u,l))).next((()=>u))})).then((i=>(t.Cs=s,i)))}function gy(n,e,t){let r=re(),s=re();return t.forEach((i=>r=r.add(i))),e.getEntries(n,r).next((i=>{let o=yt();return t.forEach(((a,u)=>{const l=i.get(a);u.isFoundDocument()!==l.isFoundDocument()&&(s=s.add(a)),u.isNoDocument()&&u.version.isEqual(J.min())?(e.removeEntry(a,u.readTime),o=o.insert(a,u)):!l.isValidDocument()||u.version.compareTo(l.version)>0||u.version.compareTo(l.version)===0&&l.hasPendingWrites?(e.addEntry(u),o=o.insert(a,u)):x(Ph,"Ignoring outdated watch update for ",a,". Current version:",l.version," Watch version:",u.version)})),{Ns:o,Bs:s}}))}function zS(n,e){const t=F(n);return t.persistence.runTransaction("Get next mutation batch","readonly",(r=>(e===void 0&&(e=or),t.mutationQueue.getNextMutationBatchAfterBatchId(r,e))))}function oi(n,e){const t=F(n);return t.persistence.runTransaction("Allocate target","readwrite",(r=>{let s;return t.ci.getTargetData(r,e).next((i=>i?(s=i,S.resolve(s)):t.ci.allocateTargetId(r).next((o=>(s=new Jt(e,o,"TargetPurposeListen",r.currentSequenceNumber),t.ci.addTargetData(r,s).next((()=>s)))))))})).then((r=>{const s=t.Cs.get(r.targetId);return(s===null||r.snapshotVersion.compareTo(s.snapshotVersion)>0)&&(t.Cs=t.Cs.insert(r.targetId,r),t.vs.set(e,r.targetId)),r}))}async function ai(n,e,t){const r=F(n),s=r.Cs.get(e),i=t?"readwrite":"readwrite-primary";try{t||await r.persistence.runTransaction("Release target",i,(o=>r.persistence.referenceDelegate.removeTarget(o,s)))}catch(o){if(!Ir(o))throw o;x(Ph,`Failed to update sequence numbers for target ${e}: ${o}`)}r.Cs=r.Cs.remove(e),r.vs.delete(s.target)}function Ac(n,e,t){const r=F(n);let s=J.min(),i=re();return r.persistence.runTransaction("Execute query","readwrite",(o=>(function(u,l,h){const f=F(u),p=f.vs.get(h);return p!==void 0?S.resolve(f.Cs.get(p)):f.ci.getTargetData(l,h)})(r,o,dt(e)).next((a=>{if(a)return s=a.lastLimboFreeSnapshotVersion,r.ci.getMatchingKeysForTargetId(o,a.targetId).next((u=>{i=u}))})).next((()=>r.Ds.getDocumentsMatchingQuery(o,e,t?s:J.min(),t?i:re()))).next((a=>(Iy(r,T_(e),a),{documents:a,Ls:i})))))}function _y(n,e){const t=F(n),r=F(t.ci),s=t.Cs.get(e);return s?Promise.resolve(s.target):t.persistence.runTransaction("Get target data","readonly",(i=>r.Rt(i,e).next((o=>o?o.target:null))))}function yy(n,e){const t=F(n),r=t.Fs.get(e)||J.min();return t.persistence.runTransaction("Get new document changes","readonly",(s=>t.Ms.getAllFromCollectionGroup(s,e,Lg(r,Ks),Number.MAX_SAFE_INTEGER))).then((s=>(Iy(t,e,s),s)))}function Iy(n,e,t){let r=n.Fs.get(e)||J.min();t.forEach(((s,i)=>{i.readTime.compareTo(r)>0&&(r=i.readTime)})),n.Fs.set(e,r)}async function KS(n,e,t,r){const s=F(n);let i=re(),o=yt();for(const l of t){const h=e.ks(l.metadata.name);l.document&&(i=i.add(h));const f=e.qs(l);f.setReadTime(e.Ks(l.metadata.readTime)),o=o.insert(h,f)}const a=s.Ms.newChangeBuffer({trackRemovals:!0}),u=await oi(s,(function(h){return dt(gi(oe.fromString(`__bundle__/docs/${h}`)))})(r));return s.persistence.runTransaction("Apply bundle documents","readwrite",(l=>gy(l,a,o).next((h=>(a.apply(l),h))).next((h=>s.ci.removeMatchingKeysForTargetId(l,u.targetId).next((()=>s.ci.addMatchingKeys(l,i,u.targetId))).next((()=>s.localDocuments.getLocalViewOfDocuments(l,h.Ns,h.Bs))).next((()=>h.Ns))))))}async function WS(n,e,t=re()){const r=await oi(n,dt(Xc(e.bundledQuery))),s=F(n);return s.persistence.runTransaction("Save named query","readwrite",(i=>{const o=je(e.readTime);if(r.snapshotVersion.compareTo(o)>=0)return s.hi.saveNamedQuery(i,e);const a=r.withResumeToken(Fe.EMPTY_BYTE_STRING,o);return s.Cs=s.Cs.insert(a.targetId,a),s.ci.updateTargetData(i,a).next((()=>s.ci.removeMatchingKeysForTargetId(i,r.targetId))).next((()=>s.ci.addMatchingKeys(i,t,r.targetId))).next((()=>s.hi.saveNamedQuery(i,e)))}))}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const wy="firestore_clients";function Fm(n,e){return`${wy}_${n}_${e}`}const Ey="firestore_mutations";function Um(n,e,t){let r=`${Ey}_${n}_${t}`;return e.isAuthenticated()&&(r+=`_${e.uid}`),r}const Ty="firestore_targets";function Gu(n,e){return`${Ty}_${n}_${e}`}/**
 * @license
 * Copyright 2018 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Wt="SharedClientState";class vc{constructor(e,t,r,s){this.user=e,this.batchId=t,this.state=r,this.error=s}static Us(e,t,r){const s=JSON.parse(r);let i,o=typeof s=="object"&&["pending","acknowledged","rejected"].indexOf(s.state)!==-1&&(s.error===void 0||typeof s.error=="object");return o&&s.error&&(o=typeof s.error.message=="string"&&typeof s.error.code=="string",o&&(i=new D(s.error.code,s.error.message))),o?new vc(e,t,s.state,i):(qe(Wt,`Failed to parse mutation state for ID '${t}': ${r}`),null)}$s(){const e={state:this.state,updateTimeMs:Date.now()};return this.error&&(e.error={code:this.error.code,message:this.error.message}),JSON.stringify(e)}}class vo{constructor(e,t,r){this.targetId=e,this.state=t,this.error=r}static Us(e,t){const r=JSON.parse(t);let s,i=typeof r=="object"&&["not-current","current","rejected"].indexOf(r.state)!==-1&&(r.error===void 0||typeof r.error=="object");return i&&r.error&&(i=typeof r.error.message=="string"&&typeof r.error.code=="string",i&&(s=new D(r.error.code,r.error.message))),i?new vo(e,r.state,s):(qe(Wt,`Failed to parse target state for ID '${e}': ${t}`),null)}$s(){const e={state:this.state,updateTimeMs:Date.now()};return this.error&&(e.error={code:this.error.code,message:this.error.message}),JSON.stringify(e)}}class bc{constructor(e,t){this.clientId=e,this.activeTargetIds=t}static Us(e,t){const r=JSON.parse(t);let s=typeof r=="object"&&r.activeTargetIds instanceof Array,i=dh();for(let o=0;s&&o<r.activeTargetIds.length;++o)s=qg(r.activeTargetIds[o]),i=i.add(r.activeTargetIds[o]);return s?new bc(e,i):(qe(Wt,`Failed to parse client data for instance '${e}': ${t}`),null)}}class kh{constructor(e,t){this.clientId=e,this.onlineState=t}static Us(e){const t=JSON.parse(e);return typeof t=="object"&&["Unknown","Online","Offline"].indexOf(t.onlineState)!==-1&&typeof t.clientId=="string"?new kh(t.clientId,t.onlineState):(qe(Wt,`Failed to parse online state: ${e}`),null)}}class Pl{constructor(){this.activeTargetIds=dh()}Ws(e){this.activeTargetIds=this.activeTargetIds.add(e)}Qs(e){this.activeTargetIds=this.activeTargetIds.delete(e)}$s(){const e={activeTargetIds:this.activeTargetIds.toArray(),updateTimeMs:Date.now()};return JSON.stringify(e)}}class zu{constructor(e,t,r,s,i){this.window=e,this.Di=t,this.persistenceKey=r,this.Gs=s,this.syncEngine=null,this.onlineStateHandler=null,this.sequenceNumberHandler=null,this.zs=this.js.bind(this),this.Js=new ve(Z),this.started=!1,this.Hs=[];const o=r.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");this.storage=this.window.localStorage,this.currentUser=i,this.Zs=Fm(this.persistenceKey,this.Gs),this.Xs=(function(u){return`firestore_sequence_number_${u}`})(this.persistenceKey),this.Js=this.Js.insert(this.Gs,new Pl),this.Ys=new RegExp(`^${wy}_${o}_([^_]*)$`),this.eo=new RegExp(`^${Ey}_${o}_(\\d+)(?:_(.*))?$`),this.no=new RegExp(`^${Ty}_${o}_(\\d+)$`),this.ro=(function(u){return`firestore_online_state_${u}`})(this.persistenceKey),this.io=(function(u){return`firestore_bundle_loaded_v2_${u}`})(this.persistenceKey),this.window.addEventListener("storage",this.zs)}static v(e){return!(!e||!e.localStorage)}async start(){const e=await this.syncEngine.ls();for(const r of e){if(r===this.Gs)continue;const s=this.getItem(Fm(this.persistenceKey,r));if(s){const i=bc.Us(r,s);i&&(this.Js=this.Js.insert(i.clientId,i))}}this.so();const t=this.storage.getItem(this.ro);if(t){const r=this.oo(t);r&&this._o(r)}for(const r of this.Hs)this.js(r);this.Hs=[],this.window.addEventListener("pagehide",(()=>this.shutdown())),this.started=!0}writeSequenceNumber(e){this.setItem(this.Xs,JSON.stringify(e))}getAllActiveQueryTargets(){return this.ao(this.Js)}isActiveQueryTarget(e){let t=!1;return this.Js.forEach(((r,s)=>{s.activeTargetIds.has(e)&&(t=!0)})),t}addPendingMutation(e){this.uo(e,"pending")}updateMutationState(e,t,r){this.uo(e,t,r),this.co(e)}addLocalQueryTarget(e,t=!0){let r="not-current";if(this.isActiveQueryTarget(e)){const s=this.storage.getItem(Gu(this.persistenceKey,e));if(s){const i=vo.Us(e,s);i&&(r=i.state)}}return t&&this.lo.Ws(e),this.so(),r}removeLocalQueryTarget(e){this.lo.Qs(e),this.so()}isLocalQueryTarget(e){return this.lo.activeTargetIds.has(e)}clearQueryState(e){this.removeItem(Gu(this.persistenceKey,e))}updateQueryState(e,t,r){this.ho(e,t,r)}handleUserChange(e,t,r){t.forEach((s=>{this.co(s)})),this.currentUser=e,r.forEach((s=>{this.addPendingMutation(s)}))}setOnlineState(e){this.Po(e)}notifyBundleLoaded(e){this.To(e)}shutdown(){this.started&&(this.window.removeEventListener("storage",this.zs),this.removeItem(this.Zs),this.started=!1)}getItem(e){const t=this.storage.getItem(e);return x(Wt,"READ",e,t),t}setItem(e,t){x(Wt,"SET",e,t),this.storage.setItem(e,t)}removeItem(e){x(Wt,"REMOVE",e),this.storage.removeItem(e)}js(e){const t=e;if(t.storageArea===this.storage){if(x(Wt,"EVENT",t.key,t.newValue),t.key===this.Zs)return void qe("Received WebStorage notification for local change. Another client might have garbage-collected our state");this.Di.enqueueRetryable((async()=>{if(this.started){if(t.key!==null){if(this.Ys.test(t.key)){if(t.newValue==null){const r=this.Io(t.key);return this.Eo(r,null)}{const r=this.Ro(t.key,t.newValue);if(r)return this.Eo(r.clientId,r)}}else if(this.eo.test(t.key)){if(t.newValue!==null){const r=this.Ao(t.key,t.newValue);if(r)return this.Vo(r)}}else if(this.no.test(t.key)){if(t.newValue!==null){const r=this.mo(t.key,t.newValue);if(r)return this.fo(r)}}else if(t.key===this.ro){if(t.newValue!==null){const r=this.oo(t.newValue);if(r)return this._o(r)}}else if(t.key===this.Xs){const r=(function(i){let o=gt.ce;if(i!=null)try{const a=JSON.parse(i);K(typeof a=="number",30636,{po:i}),o=a}catch(a){qe(Wt,"Failed to read sequence number from WebStorage",a)}return o})(t.newValue);r!==gt.ce&&this.sequenceNumberHandler(r)}else if(t.key===this.io){const r=this.yo(t.newValue);await Promise.all(r.map((s=>this.syncEngine.wo(s))))}}}else this.Hs.push(t)}))}}get lo(){return this.Js.get(this.Gs)}so(){this.setItem(this.Zs,this.lo.$s())}uo(e,t,r){const s=new vc(this.currentUser,e,t,r),i=Um(this.persistenceKey,this.currentUser,e);this.setItem(i,s.$s())}co(e){const t=Um(this.persistenceKey,this.currentUser,e);this.removeItem(t)}Po(e){const t={clientId:this.Gs,onlineState:e};this.storage.setItem(this.ro,JSON.stringify(t))}ho(e,t,r){const s=Gu(this.persistenceKey,e),i=new vo(e,t,r);this.setItem(s,i.$s())}To(e){const t=JSON.stringify(Array.from(e));this.setItem(this.io,t)}Io(e){const t=this.Ys.exec(e);return t?t[1]:null}Ro(e,t){const r=this.Io(e);return bc.Us(r,t)}Ao(e,t){const r=this.eo.exec(e),s=Number(r[1]),i=r[2]!==void 0?r[2]:null;return vc.Us(new nt(i),s,t)}mo(e,t){const r=this.no.exec(e),s=Number(r[1]);return vo.Us(s,t)}oo(e){return kh.Us(e)}yo(e){return JSON.parse(e)}async Vo(e){if(e.user.uid===this.currentUser.uid)return this.syncEngine.So(e.batchId,e.state,e.error);x(Wt,`Ignoring mutation for non-active user ${e.user.uid}`)}fo(e){return this.syncEngine.bo(e.targetId,e.state,e.error)}Eo(e,t){const r=t?this.Js.insert(e,t):this.Js.remove(e),s=this.ao(this.Js),i=this.ao(r),o=[],a=[];return i.forEach((u=>{s.has(u)||o.push(u)})),s.forEach((u=>{i.has(u)||a.push(u)})),this.syncEngine.Do(o,a).then((()=>{this.Js=r}))}_o(e){this.Js.get(e.clientId)&&this.onlineStateHandler(e.onlineState)}ao(e){let t=dh();return e.forEach(((r,s)=>{t=t.unionWith(s.activeTargetIds)})),t}}class Ay{constructor(){this.Co=new Pl,this.vo={},this.onlineStateHandler=null,this.sequenceNumberHandler=null}addPendingMutation(e){}updateMutationState(e,t,r){}addLocalQueryTarget(e,t=!0){return t&&this.Co.Ws(e),this.vo[e]||"not-current"}updateQueryState(e,t,r){this.vo[e]=t}removeLocalQueryTarget(e){this.Co.Qs(e)}isLocalQueryTarget(e){return this.Co.activeTargetIds.has(e)}clearQueryState(e){delete this.vo[e]}getAllActiveQueryTargets(){return this.Co.activeTargetIds}isActiveQueryTarget(e){return this.Co.activeTargetIds.has(e)}start(){return this.Co=new Pl,Promise.resolve()}handleUserChange(e,t,r){}setOnlineState(e){}shutdown(){}writeSequenceNumber(e){}notifyBundleLoaded(e){}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class HS{Fo(e){}shutdown(){}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const $m="ConnectivityMonitor";class qm{constructor(){this.Mo=()=>this.xo(),this.Oo=()=>this.No(),this.Bo=[],this.Lo()}Fo(e){this.Bo.push(e)}shutdown(){window.removeEventListener("online",this.Mo),window.removeEventListener("offline",this.Oo)}Lo(){window.addEventListener("online",this.Mo),window.addEventListener("offline",this.Oo)}xo(){x($m,"Network connectivity changed: AVAILABLE");for(const e of this.Bo)e(0)}No(){x($m,"Network connectivity changed: UNAVAILABLE");for(const e of this.Bo)e(1)}static v(){return typeof window<"u"&&window.addEventListener!==void 0&&window.removeEventListener!==void 0}}/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */let Ma=null;function kl(){return Ma===null?Ma=(function(){return 268435456+Math.round(2147483648*Math.random())})():Ma++,"0x"+Ma.toString(16)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Ku="RestConnection",QS={BatchGetDocuments:"batchGet",Commit:"commit",RunQuery:"runQuery",RunAggregationQuery:"runAggregationQuery",ExecutePipeline:"executePipeline"};class JS{get ko(){return!1}constructor(e){this.databaseInfo=e,this.databaseId=e.databaseId;const t=e.ssl?"https":"http",r=encodeURIComponent(this.databaseId.projectId),s=encodeURIComponent(this.databaseId.database);this.qo=t+"://"+e.host,this.Ko=`projects/${r}/databases/${s}`,this.Uo=this.databaseId.database===Mo?`project_id=${r}`:`project_id=${r}&database_id=${s}`}$o(e,t,r,s,i){const o=kl(),a=this.Wo(e,t.toUriEncodedString());x(Ku,`Sending RPC '${e}' ${o}:`,a,r);const u={"google-cloud-resource-prefix":this.Ko,"x-goog-request-params":this.Uo};this.Qo(u,s,i);const{host:l}=new URL(a),h=gr(l);return this.Go(e,a,u,r,h).then((f=>(x(Ku,`Received RPC '${e}' ${o}: `,f),f)),(f=>{throw Rt(Ku,`RPC '${e}' ${o} failed with error: `,f,"url: ",a,"request:",r),f}))}zo(e,t,r,s,i,o){return this.$o(e,t,r,s,i)}Qo(e,t,r){e["X-Goog-Api-Client"]=(function(){return"gl-js/ fire/"+pi})(),e["Content-Type"]="text/plain",this.databaseInfo.appId&&(e["X-Firebase-GMPID"]=this.databaseInfo.appId),t&&t.headers.forEach(((s,i)=>e[i]=s)),r&&r.headers.forEach(((s,i)=>e[i]=s))}Wo(e,t){const r=QS[e];let s=`${this.qo}/v1/${t}:${r}`;return this.databaseInfo.apiKey&&(s=`${s}?key=${encodeURIComponent(this.databaseInfo.apiKey)}`),s}terminate(){}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class YS{constructor(e){this.jo=e.jo,this.Jo=e.Jo}Ho(e){this.Zo=e}Xo(e){this.Yo=e}e_(e){this.t_=e}onMessage(e){this.n_=e}close(){this.Jo()}send(e){this.jo(e)}r_(){this.Zo()}i_(){this.Yo()}s_(e){this.t_(e)}o_(e){this.n_(e)}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const ut="WebChannelConnection",io=(n,e,t)=>{n.listen(e,(r=>{try{t(r)}catch(s){setTimeout((()=>{throw s}),0)}}))};class Fs extends JS{constructor(e){super(e),this.__=[],this.forceLongPolling=e.forceLongPolling,this.autoDetectLongPolling=e.autoDetectLongPolling,this.useFetchStreams=e.useFetchStreams,this.longPollingOptions=e.longPollingOptions}static a_(){if(!Fs.u_){const e=Cg();io(e,kg.STAT_EVENT,(t=>{t.stat===al.PROXY?x(ut,"STAT_EVENT: detected buffering proxy"):t.stat===al.NOPROXY&&x(ut,"STAT_EVENT: detected no buffering proxy")})),Fs.u_=!0}}Go(e,t,r,s,i){const o=kl();return new Promise(((a,u)=>{const l=new Rg;l.setWithCredentials(!0),l.listenOnce(Pg.COMPLETE,(()=>{try{switch(l.getLastErrorCode()){case za.NO_ERROR:const f=l.getResponseJson();x(ut,`XHR for RPC '${e}' ${o} received:`,JSON.stringify(f)),a(f);break;case za.TIMEOUT:x(ut,`RPC '${e}' ${o} timed out`),u(new D(k.DEADLINE_EXCEEDED,"Request time out"));break;case za.HTTP_ERROR:const p=l.getStatus();if(x(ut,`RPC '${e}' ${o} failed with status:`,p,"response text:",l.getResponseText()),p>0){let _=l.getResponseJson();Array.isArray(_)&&(_=_[0]);const w=_==null?void 0:_.error;if(w&&w.status&&w.message){const b=(function(V){const O=V.toLowerCase().replace(/_/g,"-");return Object.values(k).indexOf(O)>=0?O:k.UNKNOWN})(w.status);u(new D(b,w.message))}else u(new D(k.UNKNOWN,"Server responded with status "+l.getStatus()))}else u(new D(k.UNAVAILABLE,"Connection failed."));break;default:j(9055,{c_:e,streamId:o,l_:l.getLastErrorCode(),h_:l.getLastError()})}}finally{x(ut,`RPC '${e}' ${o} completed.`)}}));const h=JSON.stringify(s);x(ut,`RPC '${e}' ${o} sending request:`,s),l.send(t,"POST",h,r,15)}))}P_(e,t,r){const s=kl(),i=[this.qo,"/","google.firestore.v1.Firestore","/",e,"/channel"],o=this.createWebChannelTransport(),a={httpSessionIdParam:"gsessionid",initMessageHeaders:{},messageUrlParams:{database:`projects/${this.databaseId.projectId}/databases/${this.databaseId.database}`},sendRawJson:!0,supportsCrossDomainXhr:!0,internalChannelParams:{forwardChannelRequestTimeoutMs:6e5},forceLongPolling:this.forceLongPolling,detectBufferingProxy:this.autoDetectLongPolling},u=this.longPollingOptions.timeoutSeconds;u!==void 0&&(a.longPollingTimeout=Math.round(1e3*u)),this.useFetchStreams&&(a.useFetchStreams=!0),this.Qo(a.initMessageHeaders,t,r),a.encodeInitMessageHeaders=!0;const l=i.join("");x(ut,`Creating RPC '${e}' stream ${s}: ${l}`,a);const h=o.createWebChannel(l,a);this.T_(h);let f=!1,p=!1;const _=new YS({jo:w=>{p?x(ut,`Not sending because RPC '${e}' stream ${s} is closed:`,w):(f||(x(ut,`Opening RPC '${e}' stream ${s} transport.`),h.open(),f=!0),x(ut,`RPC '${e}' stream ${s} sending:`,w),h.send(w))},Jo:()=>h.close()});return io(h,lo.EventType.OPEN,(()=>{p||(x(ut,`RPC '${e}' stream ${s} transport opened.`),_.r_())})),io(h,lo.EventType.CLOSE,(()=>{p||(p=!0,x(ut,`RPC '${e}' stream ${s} transport closed`),_.s_(),this.I_(h))})),io(h,lo.EventType.ERROR,(w=>{p||(p=!0,Rt(ut,`RPC '${e}' stream ${s} transport errored. Name:`,w.name,"Message:",w.message),_.s_(new D(k.UNAVAILABLE,"The operation could not be completed")))})),io(h,lo.EventType.MESSAGE,(w=>{var b;if(!p){const C=w.data[0];K(!!C,16349);const V=C,O=(V==null?void 0:V.error)||((b=V[0])==null?void 0:b.error);if(O){x(ut,`RPC '${e}' stream ${s} received error:`,O);const L=O.status;let z=(function(T){const y=ze[T];if(y!==void 0)return x_(y)})(L),ne=O.message;L==="NOT_FOUND"&&ne.includes("database")&&ne.includes("does not exist")&&ne.includes(this.databaseId.database)&&Rt(`Database '${this.databaseId.database}' not found. Please check your project configuration.`),z===void 0&&(z=k.INTERNAL,ne="Unknown error status: "+L+" with message "+O.message),p=!0,_.s_(new D(z,ne)),h.close()}else x(ut,`RPC '${e}' stream ${s} received:`,C),_.o_(C)}})),Fs.a_(),setTimeout((()=>{_.i_()}),0),_}terminate(){this.__.forEach((e=>e.close())),this.__=[]}T_(e){this.__.push(e)}I_(e){this.__=this.__.filter((t=>t===e))}Qo(e,t,r){super.Qo(e,t,r),this.databaseInfo.apiKey&&(e["x-goog-api-key"]=this.databaseInfo.apiKey)}createWebChannelTransport(){return Ng()}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function XS(n){return new Fs(n)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function vy(){return typeof window<"u"?window:null}function ec(){return typeof document<"u"?document:null}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function hs(n){return new sS(n,!0)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */Fs.u_=!1;class Ch{constructor(e,t,r=1e3,s=1.5,i=6e4){this.Di=e,this.timerId=t,this.E_=r,this.R_=s,this.A_=i,this.V_=0,this.d_=null,this.m_=Date.now(),this.reset()}reset(){this.V_=0}f_(){this.V_=this.A_}g_(e){this.cancel();const t=Math.floor(this.V_+this.p_()),r=Math.max(0,Date.now()-this.m_),s=Math.max(0,t-r);s>0&&x("ExponentialBackoff",`Backing off for ${s} ms (base delay: ${this.V_} ms, delay with jitter: ${t} ms, last attempt: ${r} ms ago)`),this.d_=this.Di.enqueueAfterDelay(this.timerId,s,(()=>(this.m_=Date.now(),e()))),this.V_*=this.R_,this.V_<this.E_&&(this.V_=this.E_),this.V_>this.A_&&(this.V_=this.A_)}y_(){this.d_!==null&&(this.d_.skipDelay(),this.d_=null)}cancel(){this.d_!==null&&(this.d_.cancel(),this.d_=null)}p_(){return(Math.random()-.5)*this.V_}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const jm="PersistentStream";class by{constructor(e,t,r,s,i,o,a,u){this.Di=e,this.w_=r,this.S_=s,this.connection=i,this.authCredentialsProvider=o,this.appCheckCredentialsProvider=a,this.listener=u,this.state=0,this.b_=0,this.D_=null,this.C_=null,this.stream=null,this.v_=0,this.F_=new Ch(e,t)}M_(){return this.state===1||this.state===5||this.x_()}x_(){return this.state===2||this.state===3}start(){this.v_=0,this.state!==4?this.auth():this.O_()}async stop(){this.M_()&&await this.close(0)}N_(){this.state=0,this.F_.reset()}B_(){this.x_()&&this.D_===null&&(this.D_=this.Di.enqueueAfterDelay(this.w_,6e4,(()=>this.L_())))}k_(e){this.q_(),this.stream.send(e)}async L_(){if(this.x_())return this.close(0)}q_(){this.D_&&(this.D_.cancel(),this.D_=null)}K_(){this.C_&&(this.C_.cancel(),this.C_=null)}async close(e,t){this.q_(),this.K_(),this.F_.cancel(),this.b_++,e!==4?this.F_.reset():t&&t.code===k.RESOURCE_EXHAUSTED?(qe(t.toString()),qe("Using maximum backoff delay to prevent overloading the backend."),this.F_.f_()):t&&t.code===k.UNAUTHENTICATED&&this.state!==3&&(this.authCredentialsProvider.invalidateToken(),this.appCheckCredentialsProvider.invalidateToken()),this.stream!==null&&(this.U_(),this.stream.close(),this.stream=null),this.state=e,await this.listener.e_(t)}U_(){}auth(){this.state=1;const e=this.W_(this.b_),t=this.b_;Promise.all([this.authCredentialsProvider.getToken(),this.appCheckCredentialsProvider.getToken()]).then((([r,s])=>{this.b_===t&&this.Q_(r,s)}),(r=>{e((()=>{const s=new D(k.UNKNOWN,"Fetching auth token failed: "+r.message);return this.G_(s)}))}))}Q_(e,t){const r=this.W_(this.b_);this.stream=this.z_(e,t),this.stream.Ho((()=>{r((()=>this.listener.Ho()))})),this.stream.Xo((()=>{r((()=>(this.state=2,this.C_=this.Di.enqueueAfterDelay(this.S_,1e4,(()=>(this.x_()&&(this.state=3),Promise.resolve()))),this.listener.Xo())))})),this.stream.e_((s=>{r((()=>this.G_(s)))})),this.stream.onMessage((s=>{r((()=>++this.v_==1?this.j_(s):this.onNext(s)))}))}O_(){this.state=5,this.F_.g_((async()=>{this.state=0,this.start()}))}G_(e){return x(jm,`close with error: ${e}`),this.stream=null,this.close(4,e)}W_(e){return t=>{this.Di.enqueueAndForget((()=>this.b_===e?t():(x(jm,"stream callback skipped by getCloseGuardedDispatcher."),Promise.resolve())))}}}class ZS extends by{constructor(e,t,r,s,i,o){super(e,"listen_stream_connection_backoff","listen_stream_idle","health_check_timeout",t,r,s,o),this.serializer=i}z_(e,t){return this.connection.P_("Listen",e,t)}j_(e){return this.onNext(e)}onNext(e){this.F_.reset();const t=aS(this.serializer,e),r=(function(i){if(!("targetChange"in i))return J.min();const o=i.targetChange;return o.targetIds&&o.targetIds.length?J.min():o.readTime?je(o.readTime):J.min()})(e);return this.listener.J_(t,r)}H_(e){const t={};t.database=Al(this.serializer),t.addTarget=(function(i,o){let a;const u=o.target;if(a=pc(u)?{documents:G_(i,u)}:{query:Yc(i,u).dt},a.targetId=o.targetId,o.resumeToken.approximateByteSize()>0){a.resumeToken=F_(i,o.resumeToken);const l=El(i,o.expectedCount);l!==null&&(a.expectedCount=l)}else if(o.snapshotVersion.compareTo(J.min())>0){a.readTime=ii(i,o.snapshotVersion.toTimestamp());const l=El(i,o.expectedCount);l!==null&&(a.expectedCount=l)}return a})(this.serializer,e);const r=uS(this.serializer,e);r&&(t.labels=r),this.k_(t)}Z_(e){const t={};t.database=Al(this.serializer),t.removeTarget=e,this.k_(t)}}class eR extends by{constructor(e,t,r,s,i,o){super(e,"write_stream_connection_backoff","write_stream_idle","health_check_timeout",t,r,s,o),this.serializer=i}get X_(){return this.v_>0}start(){this.lastStreamToken=void 0,super.start()}U_(){this.X_&&this.Y_([])}z_(e,t){return this.connection.P_("Write",e,t)}j_(e){return K(!!e.streamToken,31322),this.lastStreamToken=e.streamToken,K(!e.writeResults||e.writeResults.length===0,55816),this.listener.ea()}onNext(e){K(!!e.streamToken,12678),this.lastStreamToken=e.streamToken,this.F_.reset();const t=cS(e.writeResults,e.commitTime),r=je(e.commitTime);return this.listener.ta(r,t)}na(){const e={};e.database=Al(this.serializer),this.k_(e)}Y_(e){const t={streamToken:this.lastStreamToken,writes:e.map((r=>qo(this.serializer,r)))};this.k_(t)}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class tR{}class nR extends tR{constructor(e,t,r,s){super(),this.authCredentials=e,this.appCheckCredentials=t,this.connection=r,this.serializer=s,this.ra=!1}ia(){if(this.ra)throw new D(k.FAILED_PRECONDITION,"The client has already been terminated.")}$o(e,t,r,s){return this.ia(),Promise.all([this.authCredentials.getToken(),this.appCheckCredentials.getToken()]).then((([i,o])=>this.connection.$o(e,Tl(t,r),s,i,o))).catch((i=>{throw i.name==="FirebaseError"?(i.code===k.UNAUTHENTICATED&&(this.authCredentials.invalidateToken(),this.appCheckCredentials.invalidateToken()),i):new D(k.UNKNOWN,i.toString())}))}zo(e,t,r,s,i){return this.ia(),Promise.all([this.authCredentials.getToken(),this.appCheckCredentials.getToken()]).then((([o,a])=>this.connection.zo(e,Tl(t,r),s,o,a,i))).catch((o=>{throw o.name==="FirebaseError"?(o.code===k.UNAUTHENTICATED&&(this.authCredentials.invalidateToken(),this.appCheckCredentials.invalidateToken()),o):new D(k.UNKNOWN,o.toString())}))}terminate(){this.ra=!0,this.connection.terminate()}}function rR(n,e,t,r){return new nR(n,e,t,r)}class sR{constructor(e,t){this.asyncQueue=e,this.onlineStateHandler=t,this.state="Unknown",this.sa=0,this.oa=null,this._a=!0}aa(){this.sa===0&&(this.ua("Unknown"),this.oa=this.asyncQueue.enqueueAfterDelay("online_state_timeout",1e4,(()=>(this.oa=null,this.ca("Backend didn't respond within 10 seconds."),this.ua("Offline"),Promise.resolve()))))}la(e){this.state==="Online"?this.ua("Unknown"):(this.sa++,this.sa>=1&&(this.ha(),this.ca(`Connection failed 1 times. Most recent error: ${e.toString()}`),this.ua("Offline")))}set(e){this.ha(),this.sa=0,e==="Online"&&(this._a=!1),this.ua(e)}ua(e){e!==this.state&&(this.state=e,this.onlineStateHandler(e))}ca(e){const t=`Could not reach Cloud Firestore backend. ${e}
This typically indicates that your device does not have a healthy Internet connection at the moment. The client will operate in offline mode until it is able to successfully connect to the backend.`;this._a?(qe(t),this._a=!1):x("OnlineStateTracker",t)}ha(){this.oa!==null&&(this.oa.cancel(),this.oa=null)}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const cn="RemoteStore";class iR{constructor(e,t,r,s,i){this.localStore=e,this.datastore=t,this.asyncQueue=r,this.remoteSyncer={},this.Pa=[],this.Ta=new Map,this.Ia=new Map,this.Ea=new Map,this.Ra=new En(1e3),this.Aa=new En(1001),this.Va=new Set,this.da=[],this.ma=i,this.ma.Fo((o=>{r.enqueueAndForget((async()=>{Er(this)&&(x(cn,"Restarting streams for network reachability change."),await(async function(u){const l=F(u);l.Va.add(4),await wi(l),l.fa.set("Unknown"),l.Va.delete(4),await oa(l)})(this))}))})),this.fa=new sR(r,s)}}async function oa(n){if(Er(n))for(const e of n.da)await e(!0)}async function wi(n){for(const e of n.da)await e(!1)}function Cl(n,e){return n.Ia.get(e)||void 0}function nu(n,e){const t=F(n),r=Cl(t,e.targetId);if(r!==void 0&&t.Ta.has(r))return;const s=(function(a,u){const l=Cl(a,u);l!==void 0&&a.Ea.delete(l);const h=(function(p,_){return _%2!=0?p.Aa.next():p.Ra.next()})(a,u);return a.Ia.set(u,h),a.Ea.set(h,u),h})(t,e.targetId);x(cn,"remoteStoreListen mapping SDK target ID to remote",e.targetId,s);const i=new Jt(e.target,s,e.purpose,e.sequenceNumber,e.snapshotVersion,e.lastLimboFreeSnapshotVersion,e.resumeToken);t.Ta.set(s,i),Vh(t)?Dh(t):Ti(t).x_()&&Nh(t,i)}function ci(n,e){const t=F(n),r=Ti(t),s=Cl(t,e);x(cn,"remoteStoreUnlisten removing mapping of SDK target ID to remote",e,s),t.Ta.delete(s),t.Ia.delete(e),t.Ea.delete(s),r.x_()&&Sy(t,s),t.Ta.size===0&&(r.x_()?r.B_():Er(t)&&t.fa.set("Unknown"))}function Nh(n,e){if(n.ga.$e(e.targetId),e.resumeToken.approximateByteSize()>0||e.snapshotVersion.compareTo(J.min())>0){const t=n.Ea.get(e.targetId);if(t===void 0)return void x(cn,"SDK target ID not found for remote ID: "+e.targetId);const r=n.remoteSyncer.getRemoteKeysForTarget(t).size;e=e.withExpectedCount(r)}Ti(n).H_(e)}function Sy(n,e){n.ga.$e(e),Ti(n).Z_(e)}function Dh(n){n.ga=new eS({getRemoteKeysForTarget:e=>{const t=n.Ea.get(e);return t!==void 0?n.remoteSyncer.getRemoteKeysForTarget(t):re()},Rt:e=>n.Ta.get(e)||null,lt:()=>n.datastore.serializer.databaseId}),Ti(n).start(),n.fa.aa()}function Vh(n){return Er(n)&&!Ti(n).M_()&&n.Ta.size>0}function Er(n){return F(n).Va.size===0}function Ry(n){n.ga=void 0}async function oR(n){n.fa.set("Online")}async function aR(n){n.Ta.forEach(((e,t)=>{Nh(n,e)}))}async function cR(n,e){Ry(n),Vh(n)?(n.fa.la(e),Dh(n)):n.fa.set("Unknown")}async function uR(n,e,t){if(n.fa.set("Online"),e instanceof B_&&e.state===2&&e.cause)try{await(async function(s,i){const o=i.cause;for(const a of i.targetIds){if(s.Ta.has(a)){const u=s.Ea.get(a);u!==void 0&&(await s.remoteSyncer.rejectListen(u,o),s.Ia.delete(u),s.Ea.delete(a)),s.Ta.delete(a)}s.ga.removeTarget(a)}})(n,e)}catch(r){x(cn,"Failed to remove targets %s: %s ",e.targetIds.join(","),r),await Sc(n,r)}else if(e instanceof Xa?n.ga.Xe(e):e instanceof L_?n.ga.it(e):n.ga.tt(e),!t.isEqual(J.min()))try{const r=await py(n.localStore);t.compareTo(r)>=0&&await(function(i,o){const a=i.ga.Pt(o);a.targetChanges.forEach(((l,h)=>{if(l.resumeToken.approximateByteSize()>0){const f=i.Ta.get(h);f&&i.Ta.set(h,f.withResumeToken(l.resumeToken,o))}})),a.targetMismatches.forEach(((l,h)=>{const f=i.Ta.get(l);if(!f)return;i.Ta.set(l,f.withResumeToken(Fe.EMPTY_BYTE_STRING,f.snapshotVersion)),Sy(i,l);const p=new Jt(f.target,l,h,f.sequenceNumber);Nh(i,p)}));const u=(function(h,f){const p=new Map;f.targetChanges.forEach(((w,b)=>{const C=h.Ea.get(b);C!==void 0&&p.set(C,w)}));let _=new ve(Z);return f.targetMismatches.forEach(((w,b)=>{const C=h.Ea.get(w);C!==void 0&&(_=_.insert(C,b))})),new Ii(f.snapshotVersion,p,_,f.documentUpdates,f.resolvedLimboDocuments)})(i,a);return i.remoteSyncer.applyRemoteEvent(u)})(n,t)}catch(r){x(cn,"Failed to raise snapshot:",r),await Sc(n,r)}}async function Sc(n,e,t){if(!Ir(e))throw e;n.Va.add(1),await wi(n),n.fa.set("Offline"),t||(t=()=>py(n.localStore)),n.asyncQueue.enqueueRetryable((async()=>{x(cn,"Retrying IndexedDB access"),await t(),n.Va.delete(1),await oa(n)}))}function Py(n,e){return e().catch((t=>Sc(n,t,e)))}async function Ei(n){const e=F(n),t=dr(e);let r=e.Pa.length>0?e.Pa[e.Pa.length-1].batchId:or;for(;lR(e);)try{const s=await zS(e.localStore,r);if(s===null){e.Pa.length===0&&t.B_();break}r=s.batchId,hR(e,s)}catch(s){await Sc(e,s)}ky(e)&&Cy(e)}function lR(n){return Er(n)&&n.Pa.length<10}function hR(n,e){n.Pa.push(e);const t=dr(n);t.x_()&&t.X_&&t.Y_(e.mutations)}function ky(n){return Er(n)&&!dr(n).M_()&&n.Pa.length>0}function Cy(n){dr(n).start()}async function dR(n){dr(n).na()}async function fR(n){const e=dr(n);for(const t of n.Pa)e.Y_(t.mutations)}async function mR(n,e,t){const r=n.Pa.shift(),s=_h.from(r,e,t);await Py(n,(()=>n.remoteSyncer.applySuccessfulWrite(s))),await Ei(n)}async function pR(n,e){e&&dr(n).X_&&await(async function(r,s){if((function(o){return O_(o)&&o!==k.ABORTED})(s.code)){const i=r.Pa.shift();dr(r).N_(),await Py(r,(()=>r.remoteSyncer.rejectFailedWrite(i.batchId,s))),await Ei(r)}})(n,e),ky(n)&&Cy(n)}async function Gm(n,e){const t=F(n);t.asyncQueue.verifyOperationInProgress(),x(cn,"RemoteStore received new credentials");const r=Er(t);t.Va.add(3),await wi(t),r&&t.fa.set("Unknown"),await t.remoteSyncer.handleCredentialChange(e),t.Va.delete(3),await oa(t)}async function Nl(n,e){const t=F(n);e?(t.Va.delete(2),await oa(t)):e||(t.Va.add(2),await wi(t),t.fa.set("Unknown"))}function Ti(n){return n.pa||(n.pa=(function(t,r,s){const i=F(t);return i.ia(),new ZS(r,i.connection,i.authCredentials,i.appCheckCredentials,i.serializer,s)})(n.datastore,n.asyncQueue,{Ho:oR.bind(null,n),Xo:aR.bind(null,n),e_:cR.bind(null,n),J_:uR.bind(null,n)}),n.da.push((async e=>{e?(n.pa.N_(),Vh(n)?Dh(n):n.fa.set("Unknown")):(await n.pa.stop(),Ry(n))}))),n.pa}function dr(n){return n.ya||(n.ya=(function(t,r,s){const i=F(t);return i.ia(),new eR(r,i.connection,i.authCredentials,i.appCheckCredentials,i.serializer,s)})(n.datastore,n.asyncQueue,{Ho:()=>Promise.resolve(),Xo:dR.bind(null,n),e_:pR.bind(null,n),ea:fR.bind(null,n),ta:mR.bind(null,n)}),n.da.push((async e=>{e?(n.ya.N_(),await Ei(n)):(await n.ya.stop(),n.Pa.length>0&&(x(cn,`Stopping write stream with ${n.Pa.length} pending writes`),n.Pa=[]))}))),n.ya}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Oh{constructor(e,t,r,s,i){this.asyncQueue=e,this.timerId=t,this.targetTimeMs=r,this.op=s,this.removalCallback=i,this.deferred=new st,this.then=this.deferred.promise.then.bind(this.deferred.promise),this.deferred.promise.catch((o=>{}))}get promise(){return this.deferred.promise}static createAndSchedule(e,t,r,s,i){const o=Date.now()+r,a=new Oh(e,t,o,s,i);return a.start(r),a}start(e){this.timerHandle=setTimeout((()=>this.handleDelayElapsed()),e)}skipDelay(){return this.handleDelayElapsed()}cancel(e){this.timerHandle!==null&&(this.clearTimeout(),this.deferred.reject(new D(k.CANCELLED,"Operation cancelled"+(e?": "+e:""))))}handleDelayElapsed(){this.asyncQueue.enqueueAndForget((()=>this.timerHandle!==null?(this.clearTimeout(),this.op().then((e=>this.deferred.resolve(e)))):Promise.resolve()))}clearTimeout(){this.timerHandle!==null&&(this.removalCallback(this),clearTimeout(this.timerHandle),this.timerHandle=null)}}function Ai(n,e){if(qe("AsyncQueue",`${e}: ${n}`),Ir(n))return new D(k.UNAVAILABLE,`${e}: ${n}`);throw n}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class zr{static emptySet(e){return new zr(e.comparator)}constructor(e){this.comparator=e?(t,r)=>e(t,r)||B.comparator(t.key,r.key):(t,r)=>B.comparator(t.key,r.key),this.keyedMap=ho(),this.sortedSet=new ve(this.comparator)}has(e){return this.keyedMap.get(e)!=null}get(e){return this.keyedMap.get(e)}first(){return this.sortedSet.minKey()}last(){return this.sortedSet.maxKey()}isEmpty(){return this.sortedSet.isEmpty()}indexOf(e){const t=this.keyedMap.get(e);return t?this.sortedSet.indexOf(t):-1}get size(){return this.sortedSet.size}forEach(e){this.sortedSet.inorderTraversal(((t,r)=>(e(t),!1)))}add(e){const t=this.delete(e.key);return t.copy(t.keyedMap.insert(e.key,e),t.sortedSet.insert(e,null))}delete(e){const t=this.get(e);return t?this.copy(this.keyedMap.remove(e),this.sortedSet.remove(t)):this}isEqual(e){if(!(e instanceof zr)||this.size!==e.size)return!1;const t=this.sortedSet.getIterator(),r=e.sortedSet.getIterator();for(;t.hasNext();){const s=t.getNext().key,i=r.getNext().key;if(!s.isEqual(i))return!1}return!0}toString(){const e=[];return this.forEach((t=>{e.push(t.toString())})),e.length===0?"DocumentSet ()":`DocumentSet (
  `+e.join(`  
`)+`
)`}copy(e,t){const r=new zr;return r.comparator=this.comparator,r.keyedMap=e,r.sortedSet=t,r}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class zm{constructor(){this.wa=new ve(B.comparator)}track(e){const t=e.doc.key,r=this.wa.get(t);r?e.type!==0&&r.type===3?this.wa=this.wa.insert(t,e):e.type===3&&r.type!==1?this.wa=this.wa.insert(t,{type:r.type,doc:e.doc}):e.type===2&&r.type===2?this.wa=this.wa.insert(t,{type:2,doc:e.doc}):e.type===2&&r.type===0?this.wa=this.wa.insert(t,{type:0,doc:e.doc}):e.type===1&&r.type===0?this.wa=this.wa.remove(t):e.type===1&&r.type===2?this.wa=this.wa.insert(t,{type:1,doc:r.doc}):e.type===0&&r.type===1?this.wa=this.wa.insert(t,{type:2,doc:e.doc}):j(63341,{At:e,Sa:r}):this.wa=this.wa.insert(t,e)}ba(){const e=[];return this.wa.inorderTraversal(((t,r)=>{e.push(r)})),e}}class rs{constructor(e,t,r,s,i,o,a,u,l){this.query=e,this.docs=t,this.oldDocs=r,this.docChanges=s,this.mutatedKeys=i,this.fromCache=o,this.syncStateChanged=a,this.excludesMetadataChanges=u,this.hasCachedResults=l}static fromInitialDocuments(e,t,r,s,i){const o=[];return t.forEach((a=>{o.push({type:0,doc:a})})),new rs(e,t,zr.emptySet(t),o,r,s,!0,!1,i)}get hasPendingWrites(){return!this.mutatedKeys.isEmpty()}isEqual(e){if(!(this.fromCache===e.fromCache&&this.hasCachedResults===e.hasCachedResults&&this.syncStateChanged===e.syncStateChanged&&this.mutatedKeys.isEqual(e.mutatedKeys)&&ra(this.query,e.query)&&this.docs.isEqual(e.docs)&&this.oldDocs.isEqual(e.oldDocs)))return!1;const t=this.docChanges,r=e.docChanges;if(t.length!==r.length)return!1;for(let s=0;s<t.length;s++)if(t[s].type!==r[s].type||!t[s].doc.isEqual(r[s].doc))return!1;return!0}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class gR{constructor(){this.Da=void 0,this.Ca=[]}va(){return this.Ca.some((e=>e.Fa()))}}class _R{constructor(){this.queries=Km(),this.onlineState="Unknown",this.Ma=new Set}terminate(){(function(t,r){const s=F(t),i=s.queries;s.queries=Km(),i.forEach(((o,a)=>{for(const u of a.Ca)u.onError(r)}))})(this,new D(k.ABORTED,"Firestore shutting down"))}}function Km(){return new Sn((n=>E_(n)),ra)}async function xh(n,e){const t=F(n);let r=3;const s=e.query;let i=t.queries.get(s);i?!i.va()&&e.Fa()&&(r=2):(i=new gR,r=e.Fa()?0:1);try{switch(r){case 0:i.Da=await t.onListen(s,!0);break;case 1:i.Da=await t.onListen(s,!1);break;case 2:await t.onFirstRemoteStoreListen(s)}}catch(o){const a=Ai(o,`Initialization of query '${Ns(e.query)}' failed`);return void e.onError(a)}t.queries.set(s,i),i.Ca.push(e),e.xa(t.onlineState),i.Da&&e.Oa(i.Da)&&Lh(t)}async function Mh(n,e){const t=F(n),r=e.query;let s=3;const i=t.queries.get(r);if(i){const o=i.Ca.indexOf(e);o>=0&&(i.Ca.splice(o,1),i.Ca.length===0?s=e.Fa()?0:1:!i.va()&&e.Fa()&&(s=2))}switch(s){case 0:return t.queries.delete(r),t.onUnlisten(r,!0);case 1:return t.queries.delete(r),t.onUnlisten(r,!1);case 2:return t.onLastRemoteStoreUnlisten(r);default:return}}function yR(n,e){const t=F(n);let r=!1;for(const s of e){const i=s.query,o=t.queries.get(i);if(o){for(const a of o.Ca)a.Oa(s)&&(r=!0);o.Da=s}}r&&Lh(t)}function IR(n,e,t){const r=F(n),s=r.queries.get(e);if(s)for(const i of s.Ca)i.onError(t);r.queries.delete(e)}function Lh(n){n.Ma.forEach((e=>{e.next()}))}var Dl,Wm;(Wm=Dl||(Dl={})).Na="default",Wm.Cache="cache";class Bh{constructor(e,t,r){this.query=e,this.Ba=t,this.La=!1,this.ka=null,this.onlineState="Unknown",this.options=r||{}}Oa(e){if(!this.options.includeMetadataChanges){const r=[];for(const s of e.docChanges)s.type!==3&&r.push(s);e=new rs(e.query,e.docs,e.oldDocs,r,e.mutatedKeys,e.fromCache,e.syncStateChanged,!0,e.hasCachedResults)}let t=!1;return this.La?this.qa(e)&&(this.Ba.next(e),t=!0):this.Ka(e,this.onlineState)&&(this.Ua(e),t=!0),this.ka=e,t}onError(e){this.Ba.error(e)}xa(e){this.onlineState=e;let t=!1;return this.ka&&!this.La&&this.Ka(this.ka,e)&&(this.Ua(this.ka),t=!0),t}Ka(e,t){if(!e.fromCache||!this.Fa())return!0;const r=t!=="Offline";return(!this.options.$a||!r)&&(!e.docs.isEmpty()||e.hasCachedResults||t==="Offline")}qa(e){if(e.docChanges.length>0)return!0;const t=this.ka&&this.ka.hasPendingWrites!==e.hasPendingWrites;return!(!e.syncStateChanged&&!t)&&this.options.includeMetadataChanges===!0}Ua(e){e=rs.fromInitialDocuments(e.query,e.docs,e.mutatedKeys,e.fromCache,e.hasCachedResults),this.La=!0,this.Ba.next(e)}Fa(){return this.options.source!==Dl.Cache}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Ny{constructor(e,t){this.Wa=e,this.byteLength=t}Qa(){return"metadata"in this.Wa}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Hm{constructor(e){this.serializer=e}ks(e){return nn(this.serializer,e)}qs(e){return e.metadata.exists?Jc(this.serializer,e.document,!1):Ce.newNoDocument(this.ks(e.metadata.name),this.Ks(e.metadata.readTime))}Ks(e){return je(e)}}class Fh{constructor(e,t){this.Ga=e,this.serializer=t,this.za=[],this.ja=[],this.collectionGroups=new Set,this.progress=Dy(e)}get queries(){return this.za}get documents(){return this.ja}Ja(e){this.progress.bytesLoaded+=e.byteLength;let t=this.progress.documentsLoaded;if(e.Wa.namedQuery)this.za.push(e.Wa.namedQuery);else if(e.Wa.documentMetadata){this.ja.push({metadata:e.Wa.documentMetadata}),e.Wa.documentMetadata.exists||++t;const r=oe.fromString(e.Wa.documentMetadata.name);this.collectionGroups.add(r.get(r.length-2))}else e.Wa.document&&(this.ja[this.ja.length-1].document=e.Wa.document,++t);return t!==this.progress.documentsLoaded?(this.progress.documentsLoaded=t,{...this.progress}):null}Ha(e){const t=new Map,r=new Hm(this.serializer);for(const s of e)if(s.metadata.queries){const i=r.ks(s.metadata.name);for(const o of s.metadata.queries){const a=(t.get(o)||re()).add(i);t.set(o,a)}}return t}async Za(e){const t=await KS(e,new Hm(this.serializer),this.ja,this.Ga.id),r=this.Ha(this.documents);for(const s of this.za)await WS(e,s,r.get(s.name));return this.progress.taskState="Success",{progress:this.progress,Xa:this.collectionGroups,Ya:t}}}function Dy(n){return{taskState:"Running",documentsLoaded:0,bytesLoaded:0,totalDocuments:n.totalDocuments,totalBytes:n.totalBytes}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Vy{constructor(e){this.key=e}}class Oy{constructor(e){this.key=e}}class xy{constructor(e,t){this.query=e,this.eu=t,this.tu=null,this.hasCachedResults=!1,this.current=!1,this.nu=re(),this.mutatedKeys=re(),this.ru=A_(e),this.iu=new zr(this.ru)}get su(){return this.eu}ou(e,t){const r=t?t._u:new zm,s=t?t.iu:this.iu;let i=t?t.mutatedKeys:this.mutatedKeys,o=s,a=!1;const u=this.query.limitType==="F"&&s.size===this.query.limit?s.last():null,l=this.query.limitType==="L"&&s.size===this.query.limit?s.first():null;if(e.inorderTraversal(((h,f)=>{const p=s.get(h),_=sa(this.query,f)?f:null,w=!!p&&this.mutatedKeys.has(p.key),b=!!_&&(_.hasLocalMutations||this.mutatedKeys.has(_.key)&&_.hasCommittedMutations);let C=!1;p&&_?p.data.isEqual(_.data)?w!==b&&(r.track({type:3,doc:_}),C=!0):this.au(p,_)||(r.track({type:2,doc:_}),C=!0,(u&&this.ru(_,u)>0||l&&this.ru(_,l)<0)&&(a=!0)):!p&&_?(r.track({type:0,doc:_}),C=!0):p&&!_&&(r.track({type:1,doc:p}),C=!0,(u||l)&&(a=!0)),C&&(_?(o=o.add(_),i=b?i.add(h):i.delete(h)):(o=o.delete(h),i=i.delete(h)))})),this.query.limit!==null)for(;o.size>this.query.limit;){const h=this.query.limitType==="F"?o.last():o.first();o=o.delete(h.key),i=i.delete(h.key),r.track({type:1,doc:h})}return{iu:o,_u:r,Ss:a,mutatedKeys:i}}au(e,t){return e.hasLocalMutations&&t.hasCommittedMutations&&!t.hasLocalMutations}applyChanges(e,t,r,s){const i=this.iu;this.iu=e.iu,this.mutatedKeys=e.mutatedKeys;const o=e._u.ba();o.sort(((h,f)=>(function(_,w){const b=C=>{switch(C){case 0:return 1;case 2:case 3:return 2;case 1:return 0;default:return j(20277,{At:C})}};return b(_)-b(w)})(h.type,f.type)||this.ru(h.doc,f.doc))),this.uu(r),s=s??!1;const a=t&&!s?this.cu():[],u=this.nu.size===0&&this.current&&!s?1:0,l=u!==this.tu;return this.tu=u,o.length!==0||l?{snapshot:new rs(this.query,e.iu,i,o,e.mutatedKeys,u===0,l,!1,!!r&&r.resumeToken.approximateByteSize()>0),lu:a}:{lu:a}}xa(e){return this.current&&e==="Offline"?(this.current=!1,this.applyChanges({iu:this.iu,_u:new zm,mutatedKeys:this.mutatedKeys,Ss:!1},!1)):{lu:[]}}hu(e){return!this.eu.has(e)&&!!this.iu.has(e)&&!this.iu.get(e).hasLocalMutations}uu(e){e&&(e.addedDocuments.forEach((t=>this.eu=this.eu.add(t))),e.modifiedDocuments.forEach((t=>{})),e.removedDocuments.forEach((t=>this.eu=this.eu.delete(t))),this.current=e.current)}cu(){if(!this.current)return[];const e=this.nu;this.nu=re(),this.iu.forEach((r=>{this.hu(r.key)&&(this.nu=this.nu.add(r.key))}));const t=[];return e.forEach((r=>{this.nu.has(r)||t.push(new Oy(r))})),this.nu.forEach((r=>{e.has(r)||t.push(new Vy(r))})),t}Pu(e){this.eu=e.Ls,this.nu=re();const t=this.ou(e.documents);return this.applyChanges(t,!0)}Tu(){return rs.fromInitialDocuments(this.query,this.iu,this.mutatedKeys,this.tu===0,this.hasCachedResults)}}const Tr="SyncEngine";class wR{constructor(e,t,r){this.query=e,this.targetId=t,this.view=r}}class ER{constructor(e){this.key=e,this.Iu=!1}}class TR{constructor(e,t,r,s,i,o){this.localStore=e,this.remoteStore=t,this.eventManager=r,this.sharedClientState=s,this.currentUser=i,this.maxConcurrentLimboResolutions=o,this.Eu={},this.Ru=new Sn((a=>E_(a)),ra),this.Au=new Map,this.Vu=new Set,this.du=new ve(B.comparator),this.mu=new Map,this.fu=new Ah,this.gu={},this.pu=new Map,this.yu=En._r(),this.onlineState="Unknown",this.wu=void 0}get isPrimaryClient(){return this.wu===!0}}async function AR(n,e,t=!0){const r=ru(n);let s;const i=r.Ru.get(e);return i?(r.sharedClientState.addLocalQueryTarget(i.targetId),s=i.view.Tu()):s=await My(r,e,t,!0),s}async function vR(n,e){const t=ru(n);await My(t,e,!0,!1)}async function My(n,e,t,r){const s=await oi(n.localStore,dt(e)),i=s.targetId,o=n.sharedClientState.addLocalQueryTarget(i,t);let a;return r&&(a=await Uh(n,e,i,o==="current",s.resumeToken)),n.isPrimaryClient&&t&&nu(n.remoteStore,s),a}async function Uh(n,e,t,r,s){n.Su=(f,p,_)=>(async function(b,C,V,O){let L=C.view.ou(V);L.Ss&&(L=await Ac(b.localStore,C.query,!1).then((({documents:T})=>C.view.ou(T,L))));const z=O&&O.targetChanges.get(C.targetId),ne=O&&O.targetMismatches.get(C.targetId)!=null,H=C.view.applyChanges(L,b.isPrimaryClient,z,ne);return Vl(b,C.targetId,H.lu),H.snapshot})(n,f,p,_);const i=await Ac(n.localStore,e,!0),o=new xy(e,i.Ls),a=o.ou(i.documents),u=ia.createSynthesizedTargetChangeForCurrentChange(t,r&&n.onlineState!=="Offline",s),l=o.applyChanges(a,n.isPrimaryClient,u);Vl(n,t,l.lu);const h=new wR(e,t,o);return n.Ru.set(e,h),n.Au.has(t)?n.Au.get(t).push(e):n.Au.set(t,[e]),l.snapshot}async function bR(n,e,t){const r=F(n),s=r.Ru.get(e),i=r.Au.get(s.targetId);if(i.length>1)return r.Au.set(s.targetId,i.filter((o=>!ra(o,e)))),void r.Ru.delete(e);r.isPrimaryClient?(r.sharedClientState.removeLocalQueryTarget(s.targetId),r.sharedClientState.isActiveQueryTarget(s.targetId)||await ai(r.localStore,s.targetId,!1).then((()=>{r.sharedClientState.clearQueryState(s.targetId),t&&ci(r.remoteStore,s.targetId),ui(r,s.targetId)})).catch(yr)):(ui(r,s.targetId),await ai(r.localStore,s.targetId,!0))}async function SR(n,e){const t=F(n),r=t.Ru.get(e),s=t.Au.get(r.targetId);t.isPrimaryClient&&s.length===1&&(t.sharedClientState.removeLocalQueryTarget(r.targetId),ci(t.remoteStore,r.targetId))}async function RR(n,e,t){const r=Gh(n);try{const s=await(function(o,a){const u=F(o),l=_e.now(),h=a.reduce(((_,w)=>_.add(w.key)),re());let f,p;return u.persistence.runTransaction("Locally write mutations","readwrite",(_=>{let w=yt(),b=re();return u.Ms.getEntries(_,h).next((C=>{w=C,w.forEach(((V,O)=>{O.isValidDocument()||(b=b.add(V))}))})).next((()=>u.localDocuments.getOverlayedDocuments(_,w))).next((C=>{f=C;const V=[];for(const O of a){const L=Jb(O,f.get(O.key).overlayedDocument);L!=null&&V.push(new Rn(O.key,L,l_(L.value.mapValue),Oe.exists(!0)))}return u.mutationQueue.addMutationBatch(_,l,V,a)})).next((C=>{p=C;const V=C.applyToLocalDocumentSet(f,b);return u.documentOverlayCache.saveOverlays(_,C.batchId,V)}))})).then((()=>({batchId:p.batchId,changes:b_(f)})))})(r.localStore,e);r.sharedClientState.addPendingMutation(s.batchId),(function(o,a,u){let l=o.gu[o.currentUser.toKey()];l||(l=new ve(Z)),l=l.insert(a,u),o.gu[o.currentUser.toKey()]=l})(r,s.batchId,t),await Pn(r,s.changes),await Ei(r.remoteStore)}catch(s){const i=Ai(s,"Failed to persist write");t.reject(i)}}async function Ly(n,e){const t=F(n);try{const r=await GS(t.localStore,e);e.targetChanges.forEach(((s,i)=>{const o=t.mu.get(i);o&&(K(s.addedDocuments.size+s.modifiedDocuments.size+s.removedDocuments.size<=1,22616),s.addedDocuments.size>0?o.Iu=!0:s.modifiedDocuments.size>0?K(o.Iu,14607):s.removedDocuments.size>0&&(K(o.Iu,42227),o.Iu=!1))})),await Pn(t,r,e)}catch(r){await yr(r)}}function Qm(n,e,t){const r=F(n);if(r.isPrimaryClient&&t===0||!r.isPrimaryClient&&t===1){const s=[];r.Ru.forEach(((i,o)=>{const a=o.view.xa(e);a.snapshot&&s.push(a.snapshot)})),(function(o,a){const u=F(o);u.onlineState=a;let l=!1;u.queries.forEach(((h,f)=>{for(const p of f.Ca)p.xa(a)&&(l=!0)})),l&&Lh(u)})(r.eventManager,e),s.length&&r.Eu.J_(s),r.onlineState=e,r.isPrimaryClient&&r.sharedClientState.setOnlineState(e)}}async function PR(n,e,t){const r=F(n);r.sharedClientState.updateQueryState(e,"rejected",t);const s=r.mu.get(e),i=s&&s.key;if(i){let o=new ve(B.comparator);o=o.insert(i,Ce.newNoDocument(i,J.min()));const a=re().add(i),u=new Ii(J.min(),new Map,new ve(Z),o,a);await Ly(r,u),r.du=r.du.remove(i),r.mu.delete(e),jh(r)}else await ai(r.localStore,e,!1).then((()=>ui(r,e,t))).catch(yr)}async function kR(n,e){const t=F(n),r=e.batch.batchId;try{const s=await jS(t.localStore,e);qh(t,r,null),$h(t,r),t.sharedClientState.updateMutationState(r,"acknowledged"),await Pn(t,s)}catch(s){await yr(s)}}async function CR(n,e,t){const r=F(n);try{const s=await(function(o,a){const u=F(o);return u.persistence.runTransaction("Reject batch","readwrite-primary",(l=>{let h;return u.mutationQueue.lookupMutationBatch(l,a).next((f=>(K(f!==null,37113),h=f.keys(),u.mutationQueue.removeMutationBatch(l,f)))).next((()=>u.mutationQueue.performConsistencyCheck(l))).next((()=>u.documentOverlayCache.removeOverlaysForBatchId(l,h,a))).next((()=>u.localDocuments.recalculateAndSaveOverlaysForDocumentKeys(l,h))).next((()=>u.localDocuments.getDocuments(l,h)))}))})(r.localStore,e);qh(r,e,t),$h(r,e),r.sharedClientState.updateMutationState(e,"rejected",t),await Pn(r,s)}catch(s){await yr(s)}}async function NR(n,e){const t=F(n);Er(t.remoteStore)||x(Tr,"The network is disabled. The task returned by 'awaitPendingWrites()' will not complete until the network is enabled.");try{const r=await(function(o){const a=F(o);return a.persistence.runTransaction("Get highest unacknowledged batch id","readonly",(u=>a.mutationQueue.getHighestUnacknowledgedBatchId(u)))})(t.localStore);if(r===or)return void e.resolve();const s=t.pu.get(r)||[];s.push(e),t.pu.set(r,s)}catch(r){const s=Ai(r,"Initialization of waitForPendingWrites() operation failed");e.reject(s)}}function $h(n,e){(n.pu.get(e)||[]).forEach((t=>{t.resolve()})),n.pu.delete(e)}function qh(n,e,t){const r=F(n);let s=r.gu[r.currentUser.toKey()];if(s){const i=s.get(e);i&&(t?i.reject(t):i.resolve(),s=s.remove(e)),r.gu[r.currentUser.toKey()]=s}}function ui(n,e,t=null){n.sharedClientState.removeLocalQueryTarget(e);for(const r of n.Au.get(e))n.Ru.delete(r),t&&n.Eu.bu(r,t);n.Au.delete(e),n.isPrimaryClient&&n.fu.Qr(e).forEach((r=>{n.fu.containsKey(r)||By(n,r)}))}function By(n,e){n.Vu.delete(e.path.canonicalString());const t=n.du.get(e);t!==null&&(ci(n.remoteStore,t),n.du=n.du.remove(e),n.mu.delete(t),jh(n))}function Vl(n,e,t){for(const r of t)r instanceof Vy?(n.fu.addReference(r.key,e),DR(n,r)):r instanceof Oy?(x(Tr,"Document no longer in limbo: "+r.key),n.fu.removeReference(r.key,e),n.fu.containsKey(r.key)||By(n,r.key)):j(19791,{Du:r})}function DR(n,e){const t=e.key,r=t.path.canonicalString();n.du.get(t)||n.Vu.has(r)||(x(Tr,"New document in limbo: "+t),n.Vu.add(r),jh(n))}function jh(n){for(;n.Vu.size>0&&n.du.size<n.maxConcurrentLimboResolutions;){const e=n.Vu.values().next().value;n.Vu.delete(e);const t=new B(oe.fromString(e)),r=n.yu.next();n.mu.set(r,new ER(t)),n.du=n.du.insert(t,r),nu(n.remoteStore,new Jt(dt(gi(t.path)),r,"TargetPurposeLimboResolution",gt.ce))}}async function Pn(n,e,t){const r=F(n),s=[],i=[],o=[];r.Ru.isEmpty()||(r.Ru.forEach(((a,u)=>{o.push(r.Su(u,e,t).then((l=>{var h;if((l||t)&&r.isPrimaryClient){const f=l?!l.fromCache:(h=t==null?void 0:t.targetChanges.get(u.targetId))==null?void 0:h.current;r.sharedClientState.updateQueryState(u.targetId,f?"current":"not-current")}if(l){s.push(l);const f=Rh.Is(u.targetId,l);i.push(f)}})))})),await Promise.all(o),r.Eu.J_(s),await(async function(u,l){const h=F(u);try{await h.persistence.runTransaction("notifyLocalViewChanges","readwrite",(f=>S.forEach(l,(p=>S.forEach(p.Ps,(_=>h.persistence.referenceDelegate.addReference(f,p.targetId,_))).next((()=>S.forEach(p.Ts,(_=>h.persistence.referenceDelegate.removeReference(f,p.targetId,_)))))))))}catch(f){if(!Ir(f))throw f;x(Ph,"Failed to update sequence numbers: "+f)}for(const f of l){const p=f.targetId;if(!f.fromCache){const _=h.Cs.get(p),w=_.snapshotVersion,b=_.withLastLimboFreeSnapshotVersion(w);h.Cs=h.Cs.insert(p,b)}}})(r.localStore,i))}async function VR(n,e){const t=F(n);if(!t.currentUser.isEqual(e)){x(Tr,"User change. New user:",e.toKey());const r=await my(t.localStore,e);t.currentUser=e,(function(i,o){i.pu.forEach((a=>{a.forEach((u=>{u.reject(new D(k.CANCELLED,o))}))})),i.pu.clear()})(t,"'waitForPendingWrites' promise is rejected due to a user change."),t.sharedClientState.handleUserChange(e,r.removedBatchIds,r.addedBatchIds),await Pn(t,r.Os)}}function OR(n,e){const t=F(n),r=t.mu.get(e);if(r&&r.Iu)return re().add(r.key);{let s=re();const i=t.Au.get(e);if(!i)return s;for(const o of i){const a=t.Ru.get(o);s=s.unionWith(a.view.su)}return s}}async function xR(n,e){const t=F(n),r=await Ac(t.localStore,e.query,!0),s=e.view.Pu(r);return t.isPrimaryClient&&Vl(t,e.targetId,s.lu),s}async function MR(n,e){const t=F(n);return yy(t.localStore,e).then((r=>Pn(t,r)))}async function LR(n,e,t,r){const s=F(n),i=await(function(a,u){const l=F(a),h=F(l.mutationQueue);return l.persistence.runTransaction("Lookup mutation documents","readonly",(f=>h.Zn(f,u).next((p=>p?l.localDocuments.getDocuments(f,p):S.resolve(null)))))})(s.localStore,e);i!==null?(t==="pending"?await Ei(s.remoteStore):t==="acknowledged"||t==="rejected"?(qh(s,e,r||null),$h(s,e),(function(a,u){F(F(a).mutationQueue).tr(u)})(s.localStore,e)):j(6720,"Unknown batchState",{Cu:t}),await Pn(s,i)):x(Tr,"Cannot apply mutation batch with id: "+e)}async function BR(n,e){const t=F(n);if(ru(t),Gh(t),e===!0&&t.wu!==!0){const r=t.sharedClientState.getAllActiveQueryTargets(),s=await Jm(t,r.toArray());t.wu=!0,await Nl(t.remoteStore,!0);for(const i of s)nu(t.remoteStore,i)}else if(e===!1&&t.wu!==!1){const r=[];let s=Promise.resolve();t.Au.forEach(((i,o)=>{t.sharedClientState.isLocalQueryTarget(o)?r.push(o):s=s.then((()=>(ui(t,o),ai(t.localStore,o,!0)))),ci(t.remoteStore,o)})),await s,await Jm(t,r),(function(o){const a=F(o);a.mu.forEach(((u,l)=>{ci(a.remoteStore,l)})),a.fu.Gr(),a.mu=new Map,a.du=new ve(B.comparator)})(t),t.wu=!1,await Nl(t.remoteStore,!1)}}async function Jm(n,e,t){const r=F(n),s=[],i=[];for(const o of e){let a;const u=r.Au.get(o);if(u&&u.length!==0){a=await oi(r.localStore,dt(u[0]));for(const l of u){const h=r.Ru.get(l),f=await xR(r,h);f.snapshot&&i.push(f.snapshot)}}else{const l=await _y(r.localStore,o);a=await oi(r.localStore,l),await Uh(r,Fy(l),o,!1,a.resumeToken)}s.push(a)}return r.Eu.J_(i),s}function Fy(n){return y_(n.path,n.collectionGroup,n.orderBy,n.filters,n.limit,"F",n.startAt,n.endAt)}function FR(n){return(function(t){return F(F(t).persistence).ls()})(F(n).localStore)}async function UR(n,e,t,r){const s=F(n);if(s.wu)return void x(Tr,"Ignoring unexpected query state notification.");const i=s.Au.get(e);if(i&&i.length>0)switch(t){case"current":case"not-current":{const o=await yy(s.localStore,T_(i[0])),a=Ii.createSynthesizedRemoteEventForCurrentChange(e,t==="current",Fe.EMPTY_BYTE_STRING);await Pn(s,o,a);break}case"rejected":await ai(s.localStore,e,!0),ui(s,e,r);break;default:j(64155,t)}}async function $R(n,e,t){const r=ru(n);if(r.wu){for(const s of e){if(r.Au.has(s)&&r.sharedClientState.isActiveQueryTarget(s)){x(Tr,"Adding an already active target "+s);continue}const i=await _y(r.localStore,s),o=await oi(r.localStore,i);await Uh(r,Fy(i),o.targetId,!1,o.resumeToken),nu(r.remoteStore,o)}for(const s of t)r.Au.has(s)&&await ai(r.localStore,s,!1).then((()=>{ci(r.remoteStore,s),ui(r,s)})).catch(yr)}}function ru(n){const e=F(n);return e.remoteStore.remoteSyncer.applyRemoteEvent=Ly.bind(null,e),e.remoteStore.remoteSyncer.getRemoteKeysForTarget=OR.bind(null,e),e.remoteStore.remoteSyncer.rejectListen=PR.bind(null,e),e.Eu.J_=yR.bind(null,e.eventManager),e.Eu.bu=IR.bind(null,e.eventManager),e}function Gh(n){const e=F(n);return e.remoteStore.remoteSyncer.applySuccessfulWrite=kR.bind(null,e),e.remoteStore.remoteSyncer.rejectFailedWrite=CR.bind(null,e),e}function qR(n,e,t){const r=F(n);(async function(i,o,a){try{const u=await o.getMetadata();if(await(function(_,w){const b=F(_),C=je(w.createTime);return b.persistence.runTransaction("hasNewerBundle","readonly",(V=>b.hi.getBundleMetadata(V,w.id))).then((V=>!!V&&V.createTime.compareTo(C)>=0))})(i.localStore,u))return await o.close(),a._completeWith((function(_){return{taskState:"Success",documentsLoaded:_.totalDocuments,bytesLoaded:_.totalBytes,totalDocuments:_.totalDocuments,totalBytes:_.totalBytes}})(u)),Promise.resolve(new Set);a._updateProgress(Dy(u));const l=new Fh(u,o.serializer);let h=await o.vu();for(;h;){const p=await l.Ja(h);p&&a._updateProgress(p),h=await o.vu()}const f=await l.Za(i.localStore);return await Pn(i,f.Ya,void 0),await(function(_,w){const b=F(_);return b.persistence.runTransaction("Save bundle","readwrite",(C=>b.hi.saveBundleMetadata(C,w)))})(i.localStore,u),a._completeWith(f.progress),Promise.resolve(f.Xa)}catch(u){return Rt(Tr,`Loading bundle failed with ${u}`),a._failWith(u),Promise.resolve(new Set)}})(r,e,t).then((s=>{r.sharedClientState.notifyBundleLoaded(s)}))}class li{constructor(){this.kind="memory",this.synchronizeTabs=!1}async initialize(e){this.serializer=hs(e.databaseInfo.databaseId),this.sharedClientState=this.Fu(e),this.persistence=this.Mu(e),await this.persistence.start(),this.localStore=this.xu(e),this.gcScheduler=this.Ou(e,this.localStore),this.indexBackfillerScheduler=this.Nu(e,this.localStore)}Ou(e,t){return null}Nu(e,t){return null}xu(e){return fy(this.persistence,new dy,e.initialUser,this.serializer)}Mu(e){return new vh(tu.Ai,this.serializer)}Fu(e){return new Ay}async terminate(){var e,t;(e=this.gcScheduler)==null||e.stop(),(t=this.indexBackfillerScheduler)==null||t.stop(),this.sharedClientState.shutdown(),await this.persistence.shutdown()}}li.provider={build:()=>new li};class zh extends li{constructor(e){super(),this.cacheSizeBytes=e}Ou(e,t){K(this.persistence.referenceDelegate instanceof Tc,46915);const r=this.persistence.referenceDelegate.garbageCollector;return new oy(r,e.asyncQueue,t)}Mu(e){const t=this.cacheSizeBytes!==void 0?lt.withCacheSize(this.cacheSizeBytes):lt.DEFAULT;return new vh((r=>Tc.Ai(r,t)),this.serializer)}}class Kh extends li{constructor(e,t,r){super(),this.Bu=e,this.cacheSizeBytes=t,this.forceOwnership=r,this.kind="persistent",this.synchronizeTabs=!1}async initialize(e){await super.initialize(e),await this.Bu.initialize(this,e),await Gh(this.Bu.syncEngine),await Ei(this.Bu.remoteStore),await this.persistence.Gi((()=>(this.gcScheduler&&!this.gcScheduler.started&&this.gcScheduler.start(),this.indexBackfillerScheduler&&!this.indexBackfillerScheduler.started&&this.indexBackfillerScheduler.start(),Promise.resolve())))}xu(e){return fy(this.persistence,new dy,e.initialUser,this.serializer)}Ou(e,t){const r=this.persistence.referenceDelegate.garbageCollector;return new oy(r,e.asyncQueue,t)}Nu(e,t){const r=new Jv(t,this.persistence);return new Qv(e.asyncQueue,r)}Mu(e){const t=Sh(e.databaseInfo.databaseId,e.databaseInfo.persistenceKey),r=this.cacheSizeBytes!==void 0?lt.withCacheSize(this.cacheSizeBytes):lt.DEFAULT;return new bh(this.synchronizeTabs,t,e.clientId,r,e.asyncQueue,vy(),ec(),this.serializer,this.sharedClientState,!!this.forceOwnership)}Fu(e){return new Ay}}class Uy extends Kh{constructor(e,t){super(e,t,!1),this.Bu=e,this.cacheSizeBytes=t,this.synchronizeTabs=!0}async initialize(e){await super.initialize(e);const t=this.Bu.syncEngine;this.sharedClientState instanceof zu&&(this.sharedClientState.syncEngine={So:LR.bind(null,t),bo:UR.bind(null,t),Do:$R.bind(null,t),ls:FR.bind(null,t),wo:MR.bind(null,t)},await this.sharedClientState.start()),await this.persistence.Gi((async r=>{await BR(this.Bu.syncEngine,r),this.gcScheduler&&(r&&!this.gcScheduler.started?this.gcScheduler.start():r||this.gcScheduler.stop()),this.indexBackfillerScheduler&&(r&&!this.indexBackfillerScheduler.started?this.indexBackfillerScheduler.start():r||this.indexBackfillerScheduler.stop())}))}Fu(e){const t=vy();if(!zu.v(t))throw new D(k.UNIMPLEMENTED,"IndexedDB persistence is only available on platforms that support LocalStorage.");const r=Sh(e.databaseInfo.databaseId,e.databaseInfo.persistenceKey);return new zu(t,e.asyncQueue,r,e.clientId,e.initialUser)}}class fr{async initialize(e,t){this.localStore||(this.localStore=e.localStore,this.sharedClientState=e.sharedClientState,this.datastore=this.createDatastore(t),this.remoteStore=this.createRemoteStore(t),this.eventManager=this.createEventManager(t),this.syncEngine=this.createSyncEngine(t,!e.synchronizeTabs),this.sharedClientState.onlineStateHandler=r=>Qm(this.syncEngine,r,1),this.remoteStore.remoteSyncer.handleCredentialChange=VR.bind(null,this.syncEngine),await Nl(this.remoteStore,this.syncEngine.isPrimaryClient))}createEventManager(e){return(function(){return new _R})()}createDatastore(e){const t=hs(e.databaseInfo.databaseId),r=XS(e.databaseInfo);return rR(e.authCredentials,e.appCheckCredentials,r,t)}createRemoteStore(e){return(function(r,s,i,o,a){return new iR(r,s,i,o,a)})(this.localStore,this.datastore,e.asyncQueue,(t=>Qm(this.syncEngine,t,0)),(function(){return qm.v()?new qm:new HS})())}createSyncEngine(e,t){return(function(s,i,o,a,u,l,h){const f=new TR(s,i,o,a,u,l);return h&&(f.wu=!0),f})(this.localStore,this.remoteStore,this.eventManager,this.sharedClientState,e.initialUser,e.maxConcurrentLimboResolutions,t)}async terminate(){var e,t;await(async function(s){const i=F(s);x(cn,"RemoteStore shutting down."),i.Va.add(5),await wi(i),i.ma.shutdown(),i.fa.set("Unknown")})(this.remoteStore),(e=this.datastore)==null||e.terminate(),(t=this.eventManager)==null||t.terminate()}}fr.provider={build:()=>new fr};function Ym(n,e=10240){let t=0;return{async read(){if(t<n.byteLength){const r={value:n.slice(t,t+e),done:!1};return t+=e,r}return{done:!0}},async cancel(){},releaseLock(){},closed:Promise.resolve()}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class su{constructor(e){this.observer=e,this.muted=!1}next(e){this.muted||this.observer.next&&this.Lu(this.observer.next,e)}error(e){this.muted||(this.observer.error?this.Lu(this.observer.error,e):qe("Uncaught Error in snapshot listener:",e.toString()))}ku(){this.muted=!0}Lu(e,t){setTimeout((()=>{this.muted||e(t)}),0)}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class jR{constructor(e,t){this.qu=e,this.serializer=t,this.metadata=new st,this.buffer=new Uint8Array,this.Ku=(function(){return new TextDecoder("utf-8")})(),this.Uu().then((r=>{r&&r.Qa()?this.metadata.resolve(r.Wa.metadata):this.metadata.reject(new Error(`The first element of the bundle is not a metadata, it is
             ${JSON.stringify(r==null?void 0:r.Wa)}`))}),(r=>this.metadata.reject(r)))}close(){return this.qu.cancel()}async getMetadata(){return this.metadata.promise}async vu(){return await this.getMetadata(),this.Uu()}async Uu(){const e=await this.$u();if(e===null)return null;const t=this.Ku.decode(e),r=Number(t);isNaN(r)&&this.Wu(`length string (${t}) is not valid number`);const s=await this.Qu(r);return new Ny(JSON.parse(s),e.length+r)}Gu(){return this.buffer.findIndex((e=>e===123))}async $u(){for(;this.Gu()<0&&!await this.zu(););if(this.buffer.length===0)return null;const e=this.Gu();e<0&&this.Wu("Reached the end of bundle when a length string is expected.");const t=this.buffer.slice(0,e);return this.buffer=this.buffer.slice(e),t}async Qu(e){for(;this.buffer.length<e;)await this.zu()&&this.Wu("Reached the end of bundle when more is expected.");const t=this.Ku.decode(this.buffer.slice(0,e));return this.buffer=this.buffer.slice(e),t}Wu(e){throw this.qu.cancel(),new Error(`Invalid bundle format: ${e}`)}async zu(){const e=await this.qu.read();if(!e.done){const t=new Uint8Array(this.buffer.length+e.value.length);t.set(this.buffer),t.set(e.value,this.buffer.length),this.buffer=t}return e.done}}/**
 * @license
 * Copyright 2025 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class GR{constructor(e,t){this.bundleData=e,this.serializer=t,this.cursor=0,this.elements=[];let r=this.vu();if(!r||!r.Qa())throw new Error(`The first element of the bundle is not a metadata object, it is
         ${JSON.stringify(r==null?void 0:r.Wa)}`);this.metadata=r;do r=this.vu(),r!==null&&this.elements.push(r);while(r!==null)}getMetadata(){return this.metadata}ju(){return this.elements}vu(){if(this.cursor===this.bundleData.length)return null;const e=this.$u(),t=this.Qu(e);return new Ny(JSON.parse(t),e)}Qu(e){if(this.cursor+e>this.bundleData.length)throw new D(k.INTERNAL,"Reached the end of bundle when more is expected.");return this.bundleData.slice(this.cursor,this.cursor+=e)}$u(){const e=this.cursor;let t=this.cursor;for(;t<this.bundleData.length;){if(this.bundleData[t]==="{"){if(t===e)throw new Error("First character is a bracket and not a number");return this.cursor=t,Number(this.bundleData.slice(e,t))}t++}throw new Error("Reached the end of bundle when more is expected.")}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */let zR=class{constructor(e){this.datastore=e,this.readVersions=new Map,this.mutations=[],this.committed=!1,this.lastTransactionError=null,this.writtenDocs=new Set}async lookup(e){if(this.ensureCommitNotCalled(),this.mutations.length>0)throw this.lastTransactionError=new D(k.INVALID_ARGUMENT,"Firestore transactions require all reads to be executed before all writes."),this.lastTransactionError;const t=await(async function(s,i){const o=F(s),a={documents:i.map((f=>$o(o.serializer,f)))},u=await o.zo("BatchGetDocuments",o.serializer.databaseId,oe.emptyPath(),a,i.length),l=new Map;u.forEach((f=>{const p=oS(o.serializer,f);l.set(p.key.toString(),p)}));const h=[];return i.forEach((f=>{const p=l.get(f.toString());K(!!p,55234,{key:f}),h.push(p)})),h})(this.datastore,e);return t.forEach((r=>this.recordVersion(r))),t}set(e,t){this.write(t.toMutation(e,this.precondition(e))),this.writtenDocs.add(e.toString())}update(e,t){try{this.write(t.toMutation(e,this.preconditionForUpdate(e)))}catch(r){this.lastTransactionError=r}this.writtenDocs.add(e.toString())}delete(e){this.write(new yi(e,this.precondition(e))),this.writtenDocs.add(e.toString())}async commit(){if(this.ensureCommitNotCalled(),this.lastTransactionError)throw this.lastTransactionError;const e=this.readVersions;this.mutations.forEach((t=>{e.delete(t.key.toString())})),e.forEach(((t,r)=>{const s=B.fromPath(r);this.mutations.push(new ph(s,this.precondition(s)))})),await(async function(r,s){const i=F(r),o={writes:s.map((a=>qo(i.serializer,a)))};await i.$o("Commit",i.serializer.databaseId,oe.emptyPath(),o)})(this.datastore,this.mutations),this.committed=!0}recordVersion(e){let t;if(e.isFoundDocument())t=e.version;else{if(!e.isNoDocument())throw j(50498,{Ju:e.constructor.name});t=J.min()}const r=this.readVersions.get(e.key.toString());if(r){if(!t.isEqual(r))throw new D(k.ABORTED,"Document version changed between two reads.")}else this.readVersions.set(e.key.toString(),t)}precondition(e){const t=this.readVersions.get(e.toString());return!this.writtenDocs.has(e.toString())&&t?t.isEqual(J.min())?Oe.exists(!1):Oe.updateTime(t):Oe.none()}preconditionForUpdate(e){const t=this.readVersions.get(e.toString());if(!this.writtenDocs.has(e.toString())&&t){if(t.isEqual(J.min()))throw new D(k.INVALID_ARGUMENT,"Can't update a document that doesn't exist.");return Oe.updateTime(t)}return Oe.exists(!0)}write(e){this.ensureCommitNotCalled(),this.mutations.push(e)}ensureCommitNotCalled(){}};/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class KR{constructor(e,t,r,s,i){this.asyncQueue=e,this.datastore=t,this.options=r,this.updateFunction=s,this.deferred=i,this.Hu=r.maxAttempts,this.F_=new Ch(this.asyncQueue,"transaction_retry")}Zu(){this.Hu-=1,this.Xu()}Xu(){this.F_.g_((async()=>{const e=new zR(this.datastore),t=this.Yu(e);t&&t.then((r=>{this.asyncQueue.enqueueAndForget((()=>e.commit().then((()=>{this.deferred.resolve(r)})).catch((s=>{this.ec(s)}))))})).catch((r=>{this.ec(r)}))}))}Yu(e){try{const t=this.updateFunction(e);return!ea(t)&&t.catch&&t.then?t:(this.deferred.reject(Error("Transaction callback must return a Promise")),null)}catch(t){return this.deferred.reject(t),null}}ec(e){this.Hu>0&&this.tc(e)?(this.Hu-=1,this.asyncQueue.enqueueAndForget((()=>(this.Xu(),Promise.resolve())))):this.deferred.reject(e)}tc(e){if((e==null?void 0:e.name)==="FirebaseError"){const t=e.code;return t==="aborted"||t==="failed-precondition"||t==="already-exists"||!O_(t)}return!1}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const mr="FirestoreClient";class WR{constructor(e,t,r,s,i){this.authCredentials=e,this.appCheckCredentials=t,this.asyncQueue=r,this._databaseInfo=s,this.user=nt.UNAUTHENTICATED,this.clientId=eh.newId(),this.authCredentialListener=()=>Promise.resolve(),this.appCheckCredentialListener=()=>Promise.resolve(),this._uninitializedComponentsProvider=i,this.authCredentials.start(r,(async o=>{x(mr,"Received user=",o.uid),await this.authCredentialListener(o),this.user=o})),this.appCheckCredentials.start(r,(o=>(x(mr,"Received new app check token=",o),this.appCheckCredentialListener(o,this.user))))}get configuration(){return{asyncQueue:this.asyncQueue,databaseInfo:this._databaseInfo,clientId:this.clientId,authCredentials:this.authCredentials,appCheckCredentials:this.appCheckCredentials,initialUser:this.user,maxConcurrentLimboResolutions:100}}setCredentialChangeListener(e){this.authCredentialListener=e}setAppCheckTokenChangeListener(e){this.appCheckCredentialListener=e}terminate(){this.asyncQueue.enterRestrictedMode();const e=new st;return this.asyncQueue.enqueueAndForgetEvenWhileRestricted((async()=>{try{this._onlineComponents&&await this._onlineComponents.terminate(),this._offlineComponents&&await this._offlineComponents.terminate(),this.authCredentials.shutdown(),this.appCheckCredentials.shutdown(),e.resolve()}catch(t){const r=Ai(t,"Failed to shutdown persistence");e.reject(r)}})),e.promise}}async function Wu(n,e){n.asyncQueue.verifyOperationInProgress(),x(mr,"Initializing OfflineComponentProvider");const t=n.configuration;await e.initialize(t);let r=t.initialUser;n.setCredentialChangeListener((async s=>{r.isEqual(s)||(await my(e.localStore,s),r=s)})),e.persistence.setDatabaseDeletedListener((()=>n.terminate())),n._offlineComponents=e}async function Xm(n,e){n.asyncQueue.verifyOperationInProgress();const t=await Wh(n);x(mr,"Initializing OnlineComponentProvider"),await e.initialize(t,n.configuration),n.setCredentialChangeListener((r=>Gm(e.remoteStore,r))),n.setAppCheckTokenChangeListener(((r,s)=>Gm(e.remoteStore,s))),n._onlineComponents=e}async function Wh(n){if(!n._offlineComponents)if(n._uninitializedComponentsProvider){x(mr,"Using user provided OfflineComponentProvider");try{await Wu(n,n._uninitializedComponentsProvider._offline)}catch(e){const t=e;if(!(function(s){return s.name==="FirebaseError"?s.code===k.FAILED_PRECONDITION||s.code===k.UNIMPLEMENTED:!(typeof DOMException<"u"&&s instanceof DOMException)||s.code===22||s.code===20||s.code===11})(t))throw t;Rt("Error using user provided cache. Falling back to memory cache: "+t),await Wu(n,new li)}}else x(mr,"Using default OfflineComponentProvider"),await Wu(n,new zh(void 0));return n._offlineComponents}async function iu(n){return n._onlineComponents||(n._uninitializedComponentsProvider?(x(mr,"Using user provided OnlineComponentProvider"),await Xm(n,n._uninitializedComponentsProvider._online)):(x(mr,"Using default OnlineComponentProvider"),await Xm(n,new fr))),n._onlineComponents}function $y(n){return Wh(n).then((e=>e.persistence))}function vi(n){return Wh(n).then((e=>e.localStore))}function qy(n){return iu(n).then((e=>e.remoteStore))}function Hh(n){return iu(n).then((e=>e.syncEngine))}function jy(n){return iu(n).then((e=>e.datastore))}async function hi(n){const e=await iu(n),t=e.eventManager;return t.onListen=AR.bind(null,e.syncEngine),t.onUnlisten=bR.bind(null,e.syncEngine),t.onFirstRemoteStoreListen=vR.bind(null,e.syncEngine),t.onLastRemoteStoreUnlisten=SR.bind(null,e.syncEngine),t}function HR(n){return n.asyncQueue.enqueue((async()=>{const e=await $y(n),t=await qy(n);return e.setNetworkEnabled(!0),(function(s){const i=F(s);return i.Va.delete(0),oa(i)})(t)}))}function QR(n){return n.asyncQueue.enqueue((async()=>{const e=await $y(n),t=await qy(n);return e.setNetworkEnabled(!1),(async function(s){const i=F(s);i.Va.add(0),await wi(i),i.fa.set("Offline")})(t)}))}function JR(n,e,t,r){const s=new su(r),i=new Bh(e,s,t);return n.asyncQueue.enqueueAndForget((async()=>xh(await hi(n),i))),()=>{s.ku(),n.asyncQueue.enqueueAndForget((async()=>Mh(await hi(n),i)))}}function YR(n,e){const t=new st;return n.asyncQueue.enqueueAndForget((async()=>(async function(s,i,o){try{const a=await(function(l,h){const f=F(l);return f.persistence.runTransaction("read document","readonly",(p=>f.localDocuments.getDocument(p,h)))})(s,i);a.isFoundDocument()?o.resolve(a):a.isNoDocument()?o.resolve(null):o.reject(new D(k.UNAVAILABLE,"Failed to get document from cache. (However, this document may exist on the server. Run again without setting 'source' in the GetOptions to attempt to retrieve the document from the server.)"))}catch(a){const u=Ai(a,`Failed to get document '${i} from cache`);o.reject(u)}})(await vi(n),e,t))),t.promise}function Gy(n,e,t={}){const r=new st;return n.asyncQueue.enqueueAndForget((async()=>(function(i,o,a,u,l){const h=new su({next:p=>{h.ku(),o.enqueueAndForget((()=>Mh(i,f)));const _=p.docs.has(a);!_&&p.fromCache?l.reject(new D(k.UNAVAILABLE,"Failed to get document because the client is offline.")):_&&p.fromCache&&u&&u.source==="server"?l.reject(new D(k.UNAVAILABLE,'Failed to get document from server. (However, this document does exist in the local cache. Run again without setting source to "server" to retrieve the cached document.)')):l.resolve(p)},error:p=>l.reject(p)}),f=new Bh(gi(a.path),h,{includeMetadataChanges:!0,$a:!0});return xh(i,f)})(await hi(n),n.asyncQueue,e,t,r))),r.promise}function XR(n,e){const t=new st;return n.asyncQueue.enqueueAndForget((async()=>(async function(s,i,o){try{const a=await Ac(s,i,!0),u=new xy(i,a.Ls),l=u.ou(a.documents),h=u.applyChanges(l,!1);o.resolve(h.snapshot)}catch(a){const u=Ai(a,`Failed to execute query '${i} against cache`);o.reject(u)}})(await vi(n),e,t))),t.promise}function zy(n,e,t={}){const r=new st;return n.asyncQueue.enqueueAndForget((async()=>(function(i,o,a,u,l){const h=new su({next:p=>{h.ku(),o.enqueueAndForget((()=>Mh(i,f))),p.fromCache&&u.source==="server"?l.reject(new D(k.UNAVAILABLE,'Failed to get documents from server. (However, these documents may exist in the local cache. Run again without setting source to "server" to retrieve the cached documents.)')):l.resolve(p)},error:p=>l.reject(p)}),f=new Bh(a,h,{includeMetadataChanges:!0,$a:!0});return xh(i,f)})(await hi(n),n.asyncQueue,e,t,r))),r.promise}function ZR(n,e,t){const r=new st;return n.asyncQueue.enqueueAndForget((async()=>{try{const s=await jy(n);r.resolve((async function(o,a,u){var b;const l=F(o),{request:h,ft:f,parent:p}=z_(l.serializer,I_(a),u);l.connection.ko||delete h.parent;const _=(await l.zo("RunAggregationQuery",l.serializer.databaseId,p,h,1)).filter((C=>!!C.result));K(_.length===1,64727);const w=(b=_[0].result)==null?void 0:b.aggregateFields;return Object.keys(w).reduce(((C,V)=>(C[f[V]]=w[V],C)),{})})(s,e,t))}catch(s){r.reject(s)}})),r.promise}function eP(n,e){const t=new st;return n.asyncQueue.enqueueAndForget((async()=>RR(await Hh(n),e,t))),t.promise}function tP(n,e){const t=new su(e);return n.asyncQueue.enqueueAndForget((async()=>(function(s,i){F(s).Ma.add(i),i.next()})(await hi(n),t))),()=>{t.ku(),n.asyncQueue.enqueueAndForget((async()=>(function(s,i){F(s).Ma.delete(i)})(await hi(n),t)))}}function nP(n,e,t){const r=new st;return n.asyncQueue.enqueueAndForget((async()=>{const s=await jy(n);new KR(n.asyncQueue,s,t,e,r).Zu()})),r.promise}function rP(n,e,t,r){const s=(function(o,a){let u;return u=typeof o=="string"?M_().encode(o):o,(function(h,f){return new jR(h,f)})((function(h,f){if(h instanceof Uint8Array)return Ym(h,f);if(h instanceof ArrayBuffer)return Ym(new Uint8Array(h),f);if(h instanceof ReadableStream)return h.getReader();throw new Error("Source of `toByteStreamReader` has to be a ArrayBuffer or ReadableStream")})(u),a)})(t,hs(e));n.asyncQueue.enqueueAndForget((async()=>{qR(await Hh(n),s,r)}))}function sP(n,e){return n.asyncQueue.enqueue((async()=>(function(r,s){const i=F(r);return i.persistence.runTransaction("Get named query","readonly",(o=>i.hi.getNamedQuery(o,s)))})(await vi(n),e)))}function Ky(n,e){return(function(r,s){return new GR(r,s)})(n,e)}function iP(n,e){return n.asyncQueue.enqueue((async()=>(async function(r,s){const i=F(r),o=i.indexManager,a=[];return i.persistence.runTransaction("Configure indexes","readwrite",(u=>o.getFieldIndexes(u).next((l=>(function(f,p,_,w,b){f=[...f],p=[...p],f.sort(_),p.sort(_);const C=f.length,V=p.length;let O=0,L=0;for(;O<V&&L<C;){const z=_(f[L],p[O]);z<0?b(f[L++]):z>0?w(p[O++]):(O++,L++)}for(;O<V;)w(p[O++]);for(;L<C;)b(f[L++])})(l,s,zv,(h=>{a.push(o.addFieldIndex(u,h))}),(h=>{a.push(o.deleteFieldIndex(u,h))})))).next((()=>S.waitFor(a)))))})(await vi(n),e)))}function oP(n,e){return n.asyncQueue.enqueue((async()=>(function(r,s){F(r).Ds.Rs=s})(await vi(n),e)))}function aP(n){return n.asyncQueue.enqueue((async()=>(function(t){const r=F(t),s=r.indexManager;return r.persistence.runTransaction("Delete All Indexes","readwrite",(i=>s.deleteAllFieldIndexes(i)))})(await vi(n))))}/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Wy(n){const e={};return n.timeoutSeconds!==void 0&&(e.timeoutSeconds=n.timeoutSeconds),e}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const cP="ComponentProvider",Zm=new Map;function uP(n,e,t,r,s){return new vb(n,e,t,s.host,s.ssl,s.experimentalForceLongPolling,s.experimentalAutoDetectLongPolling,Wy(s.experimentalLongPollingOptions),s.useFetchStreams,s.isUsingEmulator,r)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Hy="firestore.googleapis.com",ep=!0;class tp{constructor(e){if(e.host===void 0){if(e.ssl!==void 0)throw new D(k.INVALID_ARGUMENT,"Can't provide ssl option if host option is not set");this.host=Hy,this.ssl=ep}else this.host=e.host,this.ssl=e.ssl??ep;if(this.isUsingEmulator=e.emulatorOptions!==void 0,this.credentials=e.credentials,this.ignoreUndefinedProperties=!!e.ignoreUndefinedProperties,this.localCache=e.localCache,e.cacheSizeBytes===void 0)this.cacheSizeBytes=ty;else{if(e.cacheSizeBytes!==-1&&e.cacheSizeBytes<iy)throw new D(k.INVALID_ARGUMENT,"cacheSizeBytes must be at least 1048576");this.cacheSizeBytes=e.cacheSizeBytes}Gv("experimentalForceLongPolling",e.experimentalForceLongPolling,"experimentalAutoDetectLongPolling",e.experimentalAutoDetectLongPolling),this.experimentalForceLongPolling=!!e.experimentalForceLongPolling,this.experimentalForceLongPolling?this.experimentalAutoDetectLongPolling=!1:e.experimentalAutoDetectLongPolling===void 0?this.experimentalAutoDetectLongPolling=!0:this.experimentalAutoDetectLongPolling=!!e.experimentalAutoDetectLongPolling,this.experimentalLongPollingOptions=Wy(e.experimentalLongPollingOptions??{}),(function(r){if(r.timeoutSeconds!==void 0){if(isNaN(r.timeoutSeconds))throw new D(k.INVALID_ARGUMENT,`invalid long polling timeout: ${r.timeoutSeconds} (must not be NaN)`);if(r.timeoutSeconds<5)throw new D(k.INVALID_ARGUMENT,`invalid long polling timeout: ${r.timeoutSeconds} (minimum allowed value is 5)`);if(r.timeoutSeconds>30)throw new D(k.INVALID_ARGUMENT,`invalid long polling timeout: ${r.timeoutSeconds} (maximum allowed value is 30)`)}})(this.experimentalLongPollingOptions),this.useFetchStreams=!!e.useFetchStreams}isEqual(e){return this.host===e.host&&this.ssl===e.ssl&&this.credentials===e.credentials&&this.cacheSizeBytes===e.cacheSizeBytes&&this.experimentalForceLongPolling===e.experimentalForceLongPolling&&this.experimentalAutoDetectLongPolling===e.experimentalAutoDetectLongPolling&&(function(r,s){return r.timeoutSeconds===s.timeoutSeconds})(this.experimentalLongPollingOptions,e.experimentalLongPollingOptions)&&this.ignoreUndefinedProperties===e.ignoreUndefinedProperties&&this.useFetchStreams===e.useFetchStreams}}class aa{constructor(e,t,r,s){this._authCredentials=e,this._appCheckCredentials=t,this._databaseId=r,this._app=s,this.type="firestore-lite",this._persistenceKey="(lite)",this._settings=new tp({}),this._settingsFrozen=!1,this._emulatorOptions={},this._terminateTask="notTerminated"}get app(){if(!this._app)throw new D(k.FAILED_PRECONDITION,"Firestore was not initialized using the Firebase SDK. 'app' is not available");return this._app}get _initialized(){return this._settingsFrozen}get _terminated(){return this._terminateTask!=="notTerminated"}_setSettings(e){if(this._settingsFrozen)throw new D(k.FAILED_PRECONDITION,"Firestore has already been started and its settings can no longer be changed. You can only modify settings before calling any other methods on a Firestore object.");this._settings=new tp(e),this._emulatorOptions=e.emulatorOptions||{},e.credentials!==void 0&&(this._authCredentials=(function(r){if(!r)return new Ov;switch(r.type){case"firstParty":return new Bv(r.sessionIndex||"0",r.iamToken||null,r.authTokenFactory||null);case"provider":return r.client;default:throw new D(k.INVALID_ARGUMENT,"makeAuthCredentialsProvider failed due to invalid credential type")}})(e.credentials))}_getSettings(){return this._settings}_getEmulatorOptions(){return this._emulatorOptions}_freezeSettings(){return this._settingsFrozen=!0,this._settings}_delete(){return this._terminateTask==="notTerminated"&&(this._terminateTask=this._terminate()),this._terminateTask}async _restart(){this._terminateTask==="notTerminated"?await this._terminate():this._terminateTask="notTerminated"}toJSON(){return{app:this._app,databaseId:this._databaseId,settings:this._settings}}_terminate(){return(function(t){const r=Zm.get(t);r&&(x(cP,"Removing Datastore"),Zm.delete(t),r.terminate())})(this),Promise.resolve()}}function lP(n,e,t,r={}){var l;n=ae(n,aa);const s=gr(e),i=n._getSettings(),o={...i,emulatorOptions:n._getEmulatorOptions()},a=`${e}:${t}`;s&&Dc(`https://${a}`),i.host!==Hy&&i.host!==a&&Rt("Host has been set in both settings() and connectFirestoreEmulator(), emulator host will be used.");const u={...i,host:a,ssl:s,emulatorOptions:r};if(!Bt(u,o)&&(n._setSettings(u),r.mockUserToken)){let h,f;if(typeof r.mockUserToken=="string")h=r.mockUserToken,f=nt.MOCK_USER;else{h=Mp(r.mockUserToken,(l=n._app)==null?void 0:l.options.projectId);const p=r.mockUserToken.sub||r.mockUserToken.user_id;if(!p)throw new D(k.INVALID_ARGUMENT,"mockUserToken must contain 'sub' or 'user_id' field!");f=new nt(p)}n._authCredentials=new xv(new Vg(h,f))}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class it{constructor(e,t,r){this.converter=t,this._query=r,this.type="query",this.firestore=e}withConverter(e){return new it(this.firestore,e,this._query)}}class Ee{constructor(e,t,r){this.converter=t,this._key=r,this.type="document",this.firestore=e}get _path(){return this._key.path}get id(){return this._key.path.lastSegment()}get path(){return this._key.path.canonicalString()}get parent(){return new rn(this.firestore,this.converter,this._key.path.popLast())}withConverter(e){return new Ee(this.firestore,e,this._key)}toJSON(){return{type:Ee._jsonSchemaVersion,referencePath:this._key.toString()}}static fromJSON(e,t,r){if(us(t,Ee._jsonSchema))return new Ee(e,r||null,new B(oe.fromString(t.referencePath)))}}Ee._jsonSchemaVersion="firestore/documentReference/1.0",Ee._jsonSchema={type:Ke("string",Ee._jsonSchemaVersion),referencePath:Ke("string")};class rn extends it{constructor(e,t,r){super(e,t,gi(r)),this._path=r,this.type="collection"}get id(){return this._query.path.lastSegment()}get path(){return this._query.path.canonicalString()}get parent(){const e=this._path.popLast();return e.isEmpty()?null:new Ee(this.firestore,null,new B(e))}withConverter(e){return new rn(this.firestore,e,this._path)}}function te(n,e,...t){if(n=ge(n),th("collection","path",e),n instanceof aa){const r=oe.fromString(e,...t);return jf(r),new rn(n,null,r)}{if(!(n instanceof Ee||n instanceof rn))throw new D(k.INVALID_ARGUMENT,"Expected first argument to collection() to be a CollectionReference, a DocumentReference or FirebaseFirestore");const r=n._path.child(oe.fromString(e,...t));return jf(r),new rn(n.firestore,null,r)}}function $0(n,e){if(n=ae(n,aa),th("collectionGroup","collection id",e),e.indexOf("/")>=0)throw new D(k.INVALID_ARGUMENT,`Invalid collection ID '${e}' passed to function collectionGroup(). Collection IDs must not contain '/'.`);return new it(n,null,(function(r){return new bn(oe.emptyPath(),r)})(e))}function We(n,e,...t){if(n=ge(n),arguments.length===1&&(e=eh.newId()),th("doc","path",e),n instanceof aa){const r=oe.fromString(e,...t);return qf(r),new Ee(n,null,new B(r))}{if(!(n instanceof Ee||n instanceof rn))throw new D(k.INVALID_ARGUMENT,"Expected first argument to doc() to be a CollectionReference, a DocumentReference or FirebaseFirestore");const r=n._path.child(oe.fromString(e,...t));return qf(r),new Ee(n.firestore,n instanceof rn?n.converter:null,new B(r))}}function q0(n,e){return n=ge(n),e=ge(e),(n instanceof Ee||n instanceof rn)&&(e instanceof Ee||e instanceof rn)&&n.firestore===e.firestore&&n.path===e.path&&n.converter===e.converter}function Qy(n,e){return n=ge(n),e=ge(e),n instanceof it&&e instanceof it&&n.firestore===e.firestore&&ra(n._query,e._query)&&n.converter===e.converter}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const np="AsyncQueue";class rp{constructor(e=Promise.resolve()){this.nc=[],this.rc=!1,this.sc=[],this.oc=null,this._c=!1,this.ac=!1,this.uc=[],this.F_=new Ch(this,"async_queue_retry"),this.cc=()=>{const r=ec();r&&x(np,"Visibility state changed to "+r.visibilityState),this.F_.y_()},this.lc=e;const t=ec();t&&typeof t.addEventListener=="function"&&t.addEventListener("visibilitychange",this.cc)}get isShuttingDown(){return this.rc}enqueueAndForget(e){this.enqueue(e)}enqueueAndForgetEvenWhileRestricted(e){this.hc(),this.Pc(e)}enterRestrictedMode(e){if(!this.rc){this.rc=!0,this.ac=e||!1;const t=ec();t&&typeof t.removeEventListener=="function"&&t.removeEventListener("visibilitychange",this.cc)}}enqueue(e){if(this.hc(),this.rc)return new Promise((()=>{}));const t=new st;return this.Pc((()=>this.rc&&this.ac?Promise.resolve():(e().then(t.resolve,t.reject),t.promise))).then((()=>t.promise))}enqueueRetryable(e){this.enqueueAndForget((()=>(this.nc.push(e),this.Tc())))}async Tc(){if(this.nc.length!==0){try{await this.nc[0](),this.nc.shift(),this.F_.reset()}catch(e){if(!Ir(e))throw e;x(np,"Operation failed with retryable error: "+e)}this.nc.length>0&&this.F_.g_((()=>this.Tc()))}}Pc(e){const t=this.lc.then((()=>(this._c=!0,e().catch((r=>{throw this.oc=r,this._c=!1,qe("INTERNAL UNHANDLED ERROR: ",sp(r)),r})).then((r=>(this._c=!1,r))))));return this.lc=t,t}enqueueAfterDelay(e,t,r){this.hc(),this.uc.indexOf(e)>-1&&(t=0);const s=Oh.createAndSchedule(this,e,t,r,(i=>this.Ic(i)));return this.sc.push(s),s}hc(){this.oc&&j(47125,{Ec:sp(this.oc)})}verifyOperationInProgress(){}async Rc(){let e;do e=this.lc,await e;while(e!==this.lc)}Ac(e){for(const t of this.sc)if(t.timerId===e)return!0;return!1}Vc(e){return this.Rc().then((()=>{this.sc.sort(((t,r)=>t.targetTimeMs-r.targetTimeMs));for(const t of this.sc)if(t.skipDelay(),e!=="all"&&t.timerId===e)break;return this.Rc()}))}dc(e){this.uc.push(e)}Ic(e){const t=this.sc.indexOf(e);this.sc.splice(t,1)}}function sp(n){let e=n.message||"";return n.stack&&(e=n.stack.includes(n.message)?n.stack:n.message+`
`+n.stack),e}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class hP{constructor(){this._progressObserver={},this._taskCompletionResolver=new st,this._lastProgress={taskState:"Running",totalBytes:0,totalDocuments:0,bytesLoaded:0,documentsLoaded:0}}onProgress(e,t,r){this._progressObserver={next:e,error:t,complete:r}}catch(e){return this._taskCompletionResolver.promise.catch(e)}then(e,t){return this._taskCompletionResolver.promise.then(e,t)}_completeWith(e){this._updateProgress(e),this._progressObserver.complete&&this._progressObserver.complete(),this._taskCompletionResolver.resolve(e)}_failWith(e){this._lastProgress.taskState="Error",this._progressObserver.next&&this._progressObserver.next(this._lastProgress),this._progressObserver.error&&this._progressObserver.error(e),this._taskCompletionResolver.reject(e)}_updateProgress(e){this._lastProgress=e,this._progressObserver.next&&this._progressObserver.next(e)}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const j0=-1;class be extends aa{constructor(e,t,r,s){super(e,t,r,s),this.type="firestore",this._queue=new rp,this._persistenceKey=(s==null?void 0:s.name)||"[DEFAULT]"}async _terminate(){if(this._firestoreClient){const e=this._firestoreClient.terminate();this._queue=new rp(e),this._firestoreClient=void 0,await e}}}function dP(n,e,t){t||(t=Mo);const r=fi(n,"firestore");if(r.isInitialized(t)){const s=r.getImmediate({identifier:t}),i=r.getOptions(t);if(Bt(i,e))return s;throw new D(k.FAILED_PRECONDITION,"initializeFirestore() has already been called with different options. To avoid this error, call initializeFirestore() with the same options as when it was originally called, or call getFirestore() to return the already initialized instance.")}if(e.cacheSizeBytes!==void 0&&e.localCache!==void 0)throw new D(k.INVALID_ARGUMENT,"cache and cacheSizeBytes cannot be specified at the same time as cacheSizeBytes willbe deprecated. Instead, specify the cache size in the cache object");if(e.cacheSizeBytes!==void 0&&e.cacheSizeBytes!==-1&&e.cacheSizeBytes<iy)throw new D(k.INVALID_ARGUMENT,"cacheSizeBytes must be at least 1048576");return e.host&&gr(e.host)&&Dc(e.host),r.initialize({options:e,instanceIdentifier:t})}function Qh(n,e){const t=typeof n=="object"?n:Vc(),r=typeof n=="string"?n:e||Mo,s=fi(t,"firestore").getImmediate({identifier:r});if(!s._initialized){const i=Vp("firestore");i&&lP(s,...i)}return s}function xe(n){if(n._terminated)throw new D(k.FAILED_PRECONDITION,"The client has already been terminated.");return n._firestoreClient||Jy(n),n._firestoreClient}function Jy(n){var r,s,i,o;const e=n._freezeSettings(),t=uP(n._databaseId,((r=n._app)==null?void 0:r.options.appId)||"",n._persistenceKey,(s=n._app)==null?void 0:s.options.apiKey,e);n._componentsProvider||(i=e.localCache)!=null&&i._offlineComponentProvider&&((o=e.localCache)!=null&&o._onlineComponentProvider)&&(n._componentsProvider={_offline:e.localCache._offlineComponentProvider,_online:e.localCache._onlineComponentProvider}),n._firestoreClient=new WR(n._authCredentials,n._appCheckCredentials,n._queue,t,n._componentsProvider&&(function(u){const l=u==null?void 0:u._online.build();return{_offline:u==null?void 0:u._offline.build(l),_online:l}})(n._componentsProvider))}function G0(n,e){Rt("enableIndexedDbPersistence() will be deprecated in the future, you can use `FirestoreSettings.cache` instead.");const t=n._freezeSettings();return Yy(n,fr.provider,{build:r=>new Kh(r,t.cacheSizeBytes,e==null?void 0:e.forceOwnership)}),Promise.resolve()}async function z0(n){Rt("enableMultiTabIndexedDbPersistence() will be deprecated in the future, you can use `FirestoreSettings.cache` instead.");const e=n._freezeSettings();Yy(n,fr.provider,{build:t=>new Uy(t,e.cacheSizeBytes)})}function Yy(n,e,t){if((n=ae(n,be))._firestoreClient||n._terminated)throw new D(k.FAILED_PRECONDITION,"Firestore has already been started and persistence can no longer be enabled. You can only enable persistence before calling any other methods on a Firestore object.");if(n._componentsProvider||n._getSettings().localCache)throw new D(k.FAILED_PRECONDITION,"SDK cache is already specified.");n._componentsProvider={_online:e,_offline:t},Jy(n)}function K0(n){if(n._initialized&&!n._terminated)throw new D(k.FAILED_PRECONDITION,"Persistence can only be cleared before a Firestore instance is initialized or after it is terminated.");const e=new st;return n._queue.enqueueAndForgetEvenWhileRestricted((async()=>{try{await(async function(r){if(!tn.v())return Promise.resolve();const s=r+hy;await tn.delete(s)})(Sh(n._databaseId,n._persistenceKey)),e.resolve()}catch(t){e.reject(t)}})),e.promise}function W0(n){return(function(t){const r=new st;return t.asyncQueue.enqueueAndForget((async()=>NR(await Hh(t),r))),r.promise})(xe(n=ae(n,be)))}function H0(n){return HR(xe(n=ae(n,be)))}function Q0(n){return QR(xe(n=ae(n,be)))}function J0(n){return oT(n.app,"firestore",n._databaseId.database),n._delete()}function ip(n,e){const t=xe(n=ae(n,be)),r=new hP;return rP(t,n._databaseId,e,r),r}function fP(n,e){return sP(xe(n=ae(n,be)),e).then((t=>t?new it(n,null,t.query):null))}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class At{constructor(e){this._byteString=e}static fromBase64String(e){try{return new At(Fe.fromBase64String(e))}catch(t){throw new D(k.INVALID_ARGUMENT,"Failed to construct data from Base64 string: "+t)}}static fromUint8Array(e){return new At(Fe.fromUint8Array(e))}toBase64(){return this._byteString.toBase64()}toUint8Array(){return this._byteString.toUint8Array()}toString(){return"Bytes(base64: "+this.toBase64()+")"}isEqual(e){return this._byteString.isEqual(e._byteString)}toJSON(){return{type:At._jsonSchemaVersion,bytes:this.toBase64()}}static fromJSON(e){if(us(e,At._jsonSchema))return At.fromBase64String(e.bytes)}}At._jsonSchemaVersion="firestore/bytes/1.0",At._jsonSchema={type:Ke("string",At._jsonSchemaVersion),bytes:Ke("string")};/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class bi{constructor(...e){for(let t=0;t<e.length;++t)if(e[t].length===0)throw new D(k.INVALID_ARGUMENT,"Invalid field name at argument $(i + 1). Field names must not be empty.");this._internalPath=new Ve(e)}isEqual(e){return this._internalPath.isEqual(e._internalPath)}}function Y0(){return new bi(ll)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class kn{constructor(e){this._methodName=e}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class sn{constructor(e,t){if(!isFinite(e)||e<-90||e>90)throw new D(k.INVALID_ARGUMENT,"Latitude must be a number between -90 and 90, but was: "+e);if(!isFinite(t)||t<-180||t>180)throw new D(k.INVALID_ARGUMENT,"Longitude must be a number between -180 and 180, but was: "+t);this._lat=e,this._long=t}get latitude(){return this._lat}get longitude(){return this._long}isEqual(e){return this._lat===e._lat&&this._long===e._long}_compareTo(e){return Z(this._lat,e._lat)||Z(this._long,e._long)}toJSON(){return{latitude:this._lat,longitude:this._long,type:sn._jsonSchemaVersion}}static fromJSON(e){if(us(e,sn._jsonSchema))return new sn(e.latitude,e.longitude)}}sn._jsonSchemaVersion="firestore/geoPoint/1.0",sn._jsonSchema={type:Ke("string",sn._jsonSchemaVersion),latitude:Ke("number"),longitude:Ke("number")};/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Nt{constructor(e){this._values=(e||[]).map((t=>t))}toArray(){return this._values.map((e=>e))}isEqual(e){return(function(r,s){if(r.length!==s.length)return!1;for(let i=0;i<r.length;++i)if(r[i]!==s[i])return!1;return!0})(this._values,e._values)}toJSON(){return{type:Nt._jsonSchemaVersion,vectorValues:this._values}}static fromJSON(e){if(us(e,Nt._jsonSchema)){if(Array.isArray(e.vectorValues)&&e.vectorValues.every((t=>typeof t=="number")))return new Nt(e.vectorValues);throw new D(k.INVALID_ARGUMENT,"Expected 'vectorValues' field to be a number array")}}}Nt._jsonSchemaVersion="firestore/vectorValue/1.0",Nt._jsonSchema={type:Ke("string",Nt._jsonSchemaVersion),vectorValues:Ke("object")};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const mP=/^__.*__$/;class pP{constructor(e,t,r){this.data=e,this.fieldMask=t,this.fieldTransforms=r}toMutation(e,t){return this.fieldMask!==null?new Rn(e,this.data,this.fieldMask,t,this.fieldTransforms):new _i(e,this.data,t,this.fieldTransforms)}}class Xy{constructor(e,t,r){this.data=e,this.fieldMask=t,this.fieldTransforms=r}toMutation(e,t){return new Rn(e,this.data,this.fieldMask,t,this.fieldTransforms)}}function Zy(n){switch(n){case 0:case 2:case 1:return!0;case 3:case 4:return!1;default:throw j(40011,{dataSource:n})}}class ou{constructor(e,t,r,s,i,o){this.settings=e,this.databaseId=t,this.serializer=r,this.ignoreUndefinedProperties=s,i===void 0&&this.mc(),this.fieldTransforms=i||[],this.fieldMask=o||[]}get path(){return this.settings.path}get dataSource(){return this.settings.dataSource}i(e){return new ou({...this.settings,...e},this.databaseId,this.serializer,this.ignoreUndefinedProperties,this.fieldTransforms,this.fieldMask)}gc(e){var s;const t=(s=this.path)==null?void 0:s.child(e),r=this.i({path:t,arrayElement:!1});return r.yc(e),r}wc(e){var s;const t=(s=this.path)==null?void 0:s.child(e),r=this.i({path:t,arrayElement:!1});return r.mc(),r}Sc(e){return this.i({path:void 0,arrayElement:!0})}bc(e){return Rc(e,this.settings.methodName,this.settings.hasConverter||!1,this.path,this.settings.targetDoc)}contains(e){return this.fieldMask.find((t=>e.isPrefixOf(t)))!==void 0||this.fieldTransforms.find((t=>e.isPrefixOf(t.field)))!==void 0}mc(){if(this.path)for(let e=0;e<this.path.length;e++)this.yc(this.path.get(e))}yc(e){if(e.length===0)throw this.bc("Document fields must not be empty");if(Zy(this.dataSource)&&mP.test(e))throw this.bc('Document fields cannot begin and end with "__"')}}class gP{constructor(e,t,r){this.databaseId=e,this.ignoreUndefinedProperties=t,this.serializer=r||hs(e)}V(e,t,r,s=!1){return new ou({dataSource:e,methodName:t,targetDoc:r,path:Ve.emptyPath(),arrayElement:!1,hasConverter:s},this.databaseId,this.serializer,this.ignoreUndefinedProperties)}}function ds(n){const e=n._freezeSettings(),t=hs(n._databaseId);return new gP(n._databaseId,!!e.ignoreUndefinedProperties,t)}function au(n,e,t,r,s,i={}){const o=n.V(i.merge||i.mergeFields?2:0,e,t,s);sd("Data must be an object, but it was:",o,r);const a=nI(r,o);let u,l;if(i.merge)u=new _t(o.fieldMask),l=o.fieldTransforms;else if(i.mergeFields){const h=[];for(const f of i.mergeFields){const p=Tn(e,f,t);if(!o.contains(p))throw new D(k.INVALID_ARGUMENT,`Field '${p}' is specified in your field mask but missing from your input data.`);sI(h,p)||h.push(p)}u=new _t(h),l=o.fieldTransforms.filter((f=>u.covers(f.field)))}else u=null,l=o.fieldTransforms;return new pP(new rt(a),u,l)}class ca extends kn{_toFieldTransform(e){if(e.dataSource!==2)throw e.dataSource===1?e.bc(`${this._methodName}() can only appear at the top level of your update data`):e.bc(`${this._methodName}() cannot be used with set() unless you pass {merge:true}`);return e.fieldMask.push(e.path),null}isEqual(e){return e instanceof ca}}function eI(n,e,t){return new ou({dataSource:3,targetDoc:e.settings.targetDoc,methodName:n._methodName,arrayElement:t},e.databaseId,e.serializer,e.ignoreUndefinedProperties)}class Jh extends kn{_toFieldTransform(e){return new ls(e.path,new ni)}isEqual(e){return e instanceof Jh}}class Yh extends kn{constructor(e,t){super(e),this.Cc=t}_toFieldTransform(e){const t=eI(this,e,!0),r=this.Cc.map((i=>fs(i,t))),s=new Xr(r);return new ls(e.path,s)}isEqual(e){return e instanceof Yh&&Bt(this.Cc,e.Cc)}}class Xh extends kn{constructor(e,t){super(e),this.Cc=t}_toFieldTransform(e){const t=eI(this,e,!0),r=this.Cc.map((i=>fs(i,t))),s=new Zr(r);return new ls(e.path,s)}isEqual(e){return e instanceof Xh&&Bt(this.Cc,e.Cc)}}class Zh extends kn{constructor(e,t){super(e),this.vc=t}_toFieldTransform(e){const t=new es(e.serializer,Wc(e.serializer,this.vc));return new ls(e.path,t)}isEqual(e){return e instanceof Zh&&(this.vc===e.vc||Number.isNaN(this.vc)&&Number.isNaN(e.vc))}}class ed extends kn{constructor(e,t){super(e),this.vc=t}_toFieldTransform(e){const t=new ri(e.serializer,Wc(e.serializer,this.vc));return new ls(e.path,t)}isEqual(e){return e instanceof ed&&(this.vc===e.vc||Number.isNaN(this.vc)&&Number.isNaN(e.vc))}}class td extends kn{constructor(e,t){super(e),this.vc=t}_toFieldTransform(e){const t=new si(e.serializer,Wc(e.serializer,this.vc));return new ls(e.path,t)}isEqual(e){return e instanceof td&&(this.vc===e.vc||Number.isNaN(this.vc)&&Number.isNaN(e.vc))}}function nd(n,e,t,r){const s=n.V(1,e,t);sd("Data must be an object, but it was:",s,r);const i=[],o=rt.empty();wr(r,((u,l)=>{const h=id(e,u,t);l=ge(l);const f=s.wc(h);if(l instanceof ca)i.push(h);else{const p=fs(l,f);p!=null&&(i.push(h),o.set(h,p))}}));const a=new _t(i);return new Xy(o,a,s.fieldTransforms)}function rd(n,e,t,r,s,i){const o=n.V(1,e,t),a=[Tn(e,r,t)],u=[s];if(i.length%2!=0)throw new D(k.INVALID_ARGUMENT,`Function ${e}() needs to be called with an even number of arguments that alternate between field names and values.`);for(let p=0;p<i.length;p+=2)a.push(Tn(e,i[p])),u.push(i[p+1]);const l=[],h=rt.empty();for(let p=a.length-1;p>=0;--p)if(!sI(l,a[p])){const _=a[p];let w=u[p];w=ge(w);const b=o.wc(_);if(w instanceof ca)l.push(_);else{const C=fs(w,b);C!=null&&(l.push(_),h.set(_,C))}}const f=new _t(l);return new Xy(h,f,o.fieldTransforms)}function tI(n,e,t,r=!1){return fs(t,n.V(r?4:3,e))}function fs(n,e){if(rI(n=ge(n)))return sd("Unsupported field value:",e,n),nI(n,e);if(n instanceof kn)return(function(r,s){if(!Zy(s.dataSource))throw s.bc(`${r._methodName}() can only be used with update() and set()`);if(!s.path)throw s.bc(`${r._methodName}() is not currently supported inside arrays`);const i=r._toFieldTransform(s);i&&s.fieldTransforms.push(i)})(n,e),null;if(n===void 0&&e.ignoreUndefinedProperties)return null;if(e.path&&e.fieldMask.push(e.path),n instanceof Array){if(e.settings.arrayElement&&e.dataSource!==4)throw e.bc("Nested arrays are not supported");return(function(r,s){const i=[];let o=0;for(const a of r){let u=fs(a,s.Sc(o));u==null&&(u={nullValue:"NULL_VALUE"}),i.push(u),o++}return{arrayValue:{values:i}}})(n,e)}return(function(r,s){if((r=ge(r))===null)return{nullValue:"NULL_VALUE"};if(typeof r=="number")return Wc(s.serializer,r);if(typeof r=="boolean")return{booleanValue:r};if(typeof r=="string")return{stringValue:r};if(r instanceof Date){const i=_e.fromDate(r);return{timestampValue:ii(s.serializer,i)}}if(r instanceof _e){const i=new _e(r.seconds,1e3*Math.floor(r.nanoseconds/1e3));return{timestampValue:ii(s.serializer,i)}}if(r instanceof sn)return{geoPointValue:{latitude:r.latitude,longitude:r.longitude}};if(r instanceof At)return{bytesValue:F_(s.serializer,r._byteString)};if(r instanceof Ee){const i=s.databaseId,o=r.firestore._databaseId;if(!o.isEqual(i))throw s.bc(`Document reference is for database ${o.projectId}/${o.database} but should be for database ${i.projectId}/${i.database}`);return{referenceValue:wh(r.firestore._databaseId||s.databaseId,r._key.path)}}if(r instanceof Nt)return(function(o,a){const u=o instanceof Nt?o.toArray():o;return{mapValue:{fields:{[ch]:{stringValue:uh},[Zs]:{arrayValue:{values:u.map((h=>{if(typeof h!="number")throw a.bc("VectorValues must only contain numeric values.");return Kc(a.serializer,h)}))}}}}}})(r,s);if(J_(r))return r._toProto(s.serializer);throw s.bc(`Unsupported field value: ${Bc(r)}`)})(n,e)}function nI(n,e){const t={};return e_(n)?e.path&&e.path.length>0&&e.fieldMask.push(e.path):wr(n,((r,s)=>{const i=fs(s,e.gc(r));i!=null&&(t[r]=i)})),{mapValue:{fields:t}}}function rI(n){return!(typeof n!="object"||n===null||n instanceof Array||n instanceof Date||n instanceof _e||n instanceof sn||n instanceof At||n instanceof Ee||n instanceof kn||n instanceof Nt||J_(n))}function sd(n,e,t){if(!rI(t)||!xg(t)){const r=Bc(t);throw r==="an object"?e.bc(n+" a custom object"):e.bc(n+" "+r)}}function Tn(n,e,t){if((e=ge(e))instanceof bi)return e._internalPath;if(typeof e=="string")return id(n,e);throw Rc("Field path arguments must be of type string or ",n,!1,void 0,t)}const _P=new RegExp("[~\\*/\\[\\]]");function id(n,e,t){if(e.search(_P)>=0)throw Rc(`Invalid field path (${e}). Paths must not contain '~', '*', '/', '[', or ']'`,n,!1,void 0,t);try{return new bi(...e.split("."))._internalPath}catch{throw Rc(`Invalid field path (${e}). Paths must not be empty, begin with '.', end with '.', or contain '..'`,n,!1,void 0,t)}}function Rc(n,e,t,r,s){const i=r&&!r.isEmpty(),o=s!==void 0;let a=`Function ${e}() called with invalid data`;t&&(a+=" (via `toFirestore()`)"),a+=". ";let u="";return(i||o)&&(u+=" (found",i&&(u+=` in field ${r}`),o&&(u+=` in document ${s}`),u+=")"),new D(k.INVALID_ARGUMENT,a+n+u)}function sI(n,e){return n.some((t=>t.isEqual(e)))}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class iI{convertValue(e,t="none"){switch(ur(e)){case 0:return null;case 1:return e.booleanValue;case 2:return De(e.integerValue||e.doubleValue);case 3:return this.convertTimestamp(e.timestampValue);case 4:return this.convertServerTimestamp(e,t);case 5:return e.stringValue;case 6:return this.convertBytes(wn(e.bytesValue));case 7:return this.convertReference(e.referenceValue);case 8:return this.convertGeoPoint(e.geoPointValue);case 9:return this.convertArray(e.arrayValue,t);case 11:return this.convertObject(e.mapValue,t);case 10:return this.convertVectorValue(e.mapValue);default:throw j(62114,{value:e})}}convertObject(e,t){return this.convertObjectMap(e.fields,t)}convertObjectMap(e,t="none"){const r={};return wr(e,((s,i)=>{r[s]=this.convertValue(i,t)})),r}convertVectorValue(e){var r,s,i;const t=(i=(s=(r=e.fields)==null?void 0:r[Zs].arrayValue)==null?void 0:s.values)==null?void 0:i.map((o=>De(o.doubleValue)));return new Nt(t)}convertGeoPoint(e){return new sn(De(e.latitude),De(e.longitude))}convertArray(e,t){return(e.values||[]).map((r=>this.convertValue(r,t)))}convertServerTimestamp(e,t){switch(t){case"previous":const r=Gc(e);return r==null?null:this.convertValue(r,t);case"estimate":return this.convertTimestamp(xo(e));default:return null}}convertTimestamp(e){const t=In(e);return new _e(t.seconds,t.nanos)}convertDocumentKey(e,t){const r=oe.fromString(e);K(Q_(r),9688,{name:e});const s=new Qr(r.get(1),r.get(3)),i=new B(r.popFirst(5));return s.isEqual(t)||qe(`Document ${i} contains a document reference within a different database (${s.projectId}/${s.database}) which is not supported. It will be treated as a reference in the current database (${t.projectId}/${t.database}) instead.`),i}}/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Ar extends iI{constructor(e){super(),this.firestore=e}convertBytes(e){return new At(e)}convertReference(e){const t=this.convertDocumentKey(e,this.firestore._databaseId);return new Ee(this.firestore,null,t)}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function X0(){return new ca("deleteField")}function Z0(){return new Jh("serverTimestamp")}function eV(...n){return new Yh("arrayUnion",n)}function tV(...n){return new Xh("arrayRemove",n)}function nV(n){return new Zh("increment",n)}function rV(n){return new ed("minimum",n)}function sV(n){return new td("maximum",n)}function iV(n){return new Nt(n)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function oV(n){var r;const e=xe(ae(n.firestore,be)),t=(r=e._onlineComponents)==null?void 0:r.datastore.serializer;return t===void 0?null:Yc(t,dt(n._query)).dt}function aV(n,e){var i;const t=Zg(e,((o,a)=>new V_(a,o.aggregateType,o._internalFieldPath))),r=xe(ae(n.firestore,be)),s=(i=r._onlineComponents)==null?void 0:i.datastore.serializer;return s===void 0?null:z_(s,I_(n._query),t,!0).request}const op="@firebase/firestore",ap="4.15.0";/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Us(n){return(function(t,r){if(typeof t!="object"||t===null)return!1;const s=t;for(const i of r)if(i in s&&typeof s[i]=="function")return!0;return!1})(n,["next","error","complete"])}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class jo{constructor(e="count",t){this._internalFieldPath=t,this.type="AggregateField",this.aggregateType=e}}class yP{constructor(e,t,r){this._userDataWriter=t,this._data=r,this.type="AggregateQuerySnapshot",this.query=e}data(){return this._userDataWriter.convertObjectMap(this._data)}_fieldsProto(){return new rt({mapValue:{fields:this._data}}).clone().value.mapValue.fields}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Go{constructor(e,t,r,s,i){this._firestore=e,this._userDataWriter=t,this._key=r,this._document=s,this._converter=i}get id(){return this._key.path.lastSegment()}get ref(){return new Ee(this._firestore,this._converter,this._key)}exists(){return this._document!==null}data(){if(this._document){if(this._converter){const e=new IP(this._firestore,this._userDataWriter,this._key,this._document,null);return this._converter.fromFirestore(e)}return this._userDataWriter.convertValue(this._document.data.value)}}_fieldsProto(){var e;return((e=this._document)==null?void 0:e.data.clone().value.mapValue.fields)??void 0}get(e){if(this._document){const t=this._document.data.field(Tn("DocumentSnapshot.get",e));if(t!==null)return this._userDataWriter.convertValue(t)}}}class IP extends Go{data(){return super.data()}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function oI(n){if(n.limitType==="L"&&n.explicitOrderBy.length===0)throw new D(k.UNIMPLEMENTED,"limitToLast() queries require specifying at least one orderBy() clause")}class od{}class ua extends od{}function Ae(n,e,...t){let r=[];e instanceof od&&r.push(e),r=r.concat(t),(function(i){const o=i.filter((u=>u instanceof Si)).length,a=i.filter((u=>u instanceof la)).length;if(o>1||o>0&&a>0)throw new D(k.INVALID_ARGUMENT,"InvalidQuery. When using composite filters, you cannot use more than one filter at the top level. Consider nesting the multiple filters within an `and(...)` statement. For example: change `query(query, where(...), or(...))` to `query(query, and(where(...), or(...)))`.")})(r);for(const s of r)n=s._apply(n);return n}class la extends ua{constructor(e,t,r){super(),this._field=e,this._op=t,this._value=r,this.type="where"}static _create(e,t,r){return new la(e,t,r)}_apply(e){const t=this._parse(e);return cI(e._query,t),new it(e.firestore,e.converter,wl(e._query,t))}_parse(e){const t=ds(e.firestore);return(function(i,o,a,u,l,h,f){let p;if(l.isKeyField()){if(h==="array-contains"||h==="array-contains-any")throw new D(k.INVALID_ARGUMENT,`Invalid Query. You can't perform '${h}' queries on documentId().`);if(h==="in"||h==="not-in"){up(f,h);const w=[];for(const b of f)w.push(cp(u,i,b));p={arrayValue:{values:w}}}else p=cp(u,i,f)}else h!=="in"&&h!=="not-in"&&h!=="array-contains-any"||up(f,h),p=tI(a,o,f,h==="in"||h==="not-in");return ue.create(l,h,p)})(e._query,"where",t,e.firestore._databaseId,this._field,this._op,this._value)}}function Ne(n,e,t){const r=e,s=Tn("where",n);return la._create(s,r,t)}class Si extends od{constructor(e,t){super(),this.type=e,this._queryConstraints=t}static _create(e,t){return new Si(e,t)}_parse(e){const t=this._queryConstraints.map((r=>r._parse(e))).filter((r=>r.getFilters().length>0));return t.length===1?t[0]:ye.create(t,this._getOperator())}_apply(e){const t=this._parse(e);return t.getFilters().length===0?e:((function(s,i){let o=s;const a=i.getFlattenedFilters();for(const u of a)cI(o,u),o=wl(o,u)})(e._query,t),new it(e.firestore,e.converter,wl(e._query,t)))}_getQueryConstraints(){return this._queryConstraints}_getOperator(){return this.type==="and"?"and":"or"}}function cV(...n){return n.forEach((e=>uI("or",e))),Si._create("or",n)}function uV(...n){return n.forEach((e=>uI("and",e))),Si._create("and",n)}class ad extends ua{constructor(e,t){super(),this._field=e,this._direction=t,this.type="orderBy"}static _create(e,t){return new ad(e,t)}_apply(e){const t=(function(s,i,o){if(s.startAt!==null)throw new D(k.INVALID_ARGUMENT,"Invalid query. You must not call startAt() or startAfter() before calling orderBy().");if(s.endAt!==null)throw new D(k.INVALID_ARGUMENT,"Invalid query. You must not call endAt() or endBefore() before calling orderBy().");return new Uo(i,o)})(e._query,this._field,this._direction);return new it(e.firestore,e.converter,Lb(e._query,t))}}function ha(n,e="asc"){const t=e,r=Tn("orderBy",n);return ad._create(r,t)}class cu extends ua{constructor(e,t,r){super(),this.type=e,this._limit=t,this._limitType=r}static _create(e,t,r){return new cu(e,t,r)}_apply(e){return new it(e.firestore,e.converter,_c(e._query,this._limit,this._limitType))}}function lV(n){return Mg("limit",n),cu._create("limit",n,"F")}function hV(n){return Mg("limitToLast",n),cu._create("limitToLast",n,"L")}class uu extends ua{constructor(e,t,r){super(),this.type=e,this._docOrFields=t,this._inclusive=r}static _create(e,t,r){return new uu(e,t,r)}_apply(e){const t=aI(e,this.type,this._docOrFields,this._inclusive);return new it(e.firestore,e.converter,Bb(e._query,t))}}function dV(...n){return uu._create("startAt",n,!0)}function fV(...n){return uu._create("startAfter",n,!1)}class lu extends ua{constructor(e,t,r){super(),this.type=e,this._docOrFields=t,this._inclusive=r}static _create(e,t,r){return new lu(e,t,r)}_apply(e){const t=aI(e,this.type,this._docOrFields,this._inclusive);return new it(e.firestore,e.converter,Fb(e._query,t))}}function mV(...n){return lu._create("endBefore",n,!1)}function pV(...n){return lu._create("endAt",n,!0)}function aI(n,e,t,r){if(t[0]=ge(t[0]),t[0]instanceof Go)return(function(i,o,a,u,l){if(!u)throw new D(k.NOT_FOUND,`Can't use a DocumentSnapshot that doesn't exist for ${a}().`);const h=[];for(const f of Bs(i))if(f.field.isKeyField())h.push(Jr(o,u.key));else{const p=u.data.field(f.field);if(jc(p))throw new D(k.INVALID_ARGUMENT,'Invalid query. You are trying to start or end a query using a document for which the field "'+f.field+'" is an uncommitted server timestamp. (Since the value of this field is unknown, you cannot start/end a query with it.)');if(p===null){const _=f.field.canonicalString();throw new D(k.INVALID_ARGUMENT,`Invalid query. You are trying to start or end a query using a document for which the field '${_}' (used as the orderBy) does not exist.`)}h.push(p)}return new hr(h,l)})(n._query,n.firestore._databaseId,e,t[0]._document,r);{const s=ds(n.firestore);return(function(o,a,u,l,h,f){const p=o.explicitOrderBy;if(h.length>p.length)throw new D(k.INVALID_ARGUMENT,`Too many arguments provided to ${l}(). The number of arguments must be less than or equal to the number of orderBy() clauses`);const _=[];for(let w=0;w<h.length;w++){const b=h[w];if(p[w].field.isKeyField()){if(typeof b!="string")throw new D(k.INVALID_ARGUMENT,`Invalid query. Expected a string for document ID in ${l}(), but got a ${typeof b}`);if(!hh(o)&&b.indexOf("/")!==-1)throw new D(k.INVALID_ARGUMENT,`Invalid query. When querying a collection and ordering by documentId(), the value passed to ${l}() must be a plain document ID, but '${b}' contains a slash.`);const C=o.path.child(oe.fromString(b));if(!B.isDocumentKey(C))throw new D(k.INVALID_ARGUMENT,`Invalid query. When querying a collection group and ordering by documentId(), the value passed to ${l}() must result in a valid document path, but '${C}' is not because it contains an odd number of segments.`);const V=new B(C);_.push(Jr(a,V))}else{const C=tI(u,l,b);_.push(C)}}return new hr(_,f)})(n._query,n.firestore._databaseId,s,e,t,r)}}function cp(n,e,t){if(typeof(t=ge(t))=="string"){if(t==="")throw new D(k.INVALID_ARGUMENT,"Invalid query. When querying with documentId(), you must provide a valid document ID, but it was an empty string.");if(!hh(e)&&t.indexOf("/")!==-1)throw new D(k.INVALID_ARGUMENT,`Invalid query. When querying a collection by documentId(), you must provide a plain document ID, but '${t}' contains a '/' character.`);const r=e.path.child(oe.fromString(t));if(!B.isDocumentKey(r))throw new D(k.INVALID_ARGUMENT,`Invalid query. When querying a collection group by documentId(), the value provided must result in a valid document path, but '${r}' is not because it has an odd number of segments (${r.length}).`);return Jr(n,new B(r))}if(t instanceof Ee)return Jr(n,t._key);throw new D(k.INVALID_ARGUMENT,`Invalid query. When querying with documentId(), you must provide a valid string or a DocumentReference, but it was: ${Bc(t)}.`)}function up(n,e){if(!Array.isArray(n)||n.length===0)throw new D(k.INVALID_ARGUMENT,`Invalid Query. A non-empty array is required for '${e.toString()}' filters.`)}function cI(n,e){const t=(function(s,i){for(const o of s)for(const a of o.getFlattenedFilters())if(i.indexOf(a.op)>=0)return a.op;return null})(n.filters,(function(s){switch(s){case"!=":return["!=","not-in"];case"array-contains-any":case"in":return["not-in"];case"not-in":return["array-contains-any","in","not-in","!="];default:return[]}})(e.op));if(t!==null)throw t===e.op?new D(k.INVALID_ARGUMENT,`Invalid query. You cannot use more than one '${e.op.toString()}' filter.`):new D(k.INVALID_ARGUMENT,`Invalid query. You cannot use '${e.op.toString()}' filters with '${t.toString()}' filters.`)}function uI(n,e){if(!(e instanceof la||e instanceof Si))throw new D(k.INVALID_ARGUMENT,`Function ${n}() requires AppliableConstraints created with a call to 'where(...)', 'or(...)', or 'and(...)'.`)}function hu(n,e,t){let r;return r=n?t&&(t.merge||t.mergeFields)?n.toFirestore(e,t):n.toFirestore(e):e,r}class cd extends iI{constructor(e){super(),this.firestore=e}convertBytes(e){return new At(e)}convertReference(e){const t=this.convertDocumentKey(e,this.firestore._databaseId);return new Ee(this.firestore,null,t)}}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function gV(n){return new jo("sum",Tn("sum",n))}function _V(n){return new jo("avg",Tn("average",n))}function wP(){return new jo("count")}function yV(n,e){var t,r;return n instanceof jo&&e instanceof jo&&n.aggregateType===e.aggregateType&&((t=n._internalFieldPath)==null?void 0:t.canonicalString())===((r=e._internalFieldPath)==null?void 0:r.canonicalString())}function IV(n,e){return Qy(n.query,e.query)&&Bt(n.data(),e.data())}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function wV(n){return EP(n,{count:wP()})}function EP(n,e){const t=ae(n.firestore,be),r=xe(t),s=Zg(e,((i,o)=>new V_(o,i.aggregateType,i._internalFieldPath)));return ZR(r,n._query,s).then((i=>(function(a,u,l){const h=new Ar(a);return new yP(u,h,l)})(t,n,i)))}class TP{constructor(e){this.kind="memory",this._onlineComponentProvider=fr.provider,this._offlineComponentProvider=e!=null&&e.garbageCollector?e.garbageCollector._offlineComponentProvider:{build:()=>new zh(void 0)}}toJSON(){return{kind:this.kind}}}class AP{constructor(e){let t;this.kind="persistent",e!=null&&e.tabManager?(e.tabManager._initialize(e),t=e.tabManager):(t=kP(void 0),t._initialize(e)),this._onlineComponentProvider=t._onlineComponentProvider,this._offlineComponentProvider=t._offlineComponentProvider}toJSON(){return{kind:this.kind}}}class vP{constructor(){this.kind="memoryEager",this._offlineComponentProvider=li.provider}toJSON(){return{kind:this.kind}}}class bP{constructor(e){this.kind="memoryLru",this._offlineComponentProvider={build:()=>new zh(e)}}toJSON(){return{kind:this.kind}}}function EV(){return new vP}function TV(n){return new bP(n==null?void 0:n.cacheSizeBytes)}function AV(n){return new TP(n)}function SP(n){return new AP(n)}class RP{constructor(e){this.forceOwnership=e,this.kind="persistentSingleTab"}toJSON(){return{kind:this.kind}}_initialize(e){this._onlineComponentProvider=fr.provider,this._offlineComponentProvider={build:t=>new Kh(t,e==null?void 0:e.cacheSizeBytes,this.forceOwnership)}}}class PP{constructor(){this.kind="PersistentMultipleTab"}toJSON(){return{kind:this.kind}}_initialize(e){this._onlineComponentProvider=fr.provider,this._offlineComponentProvider={build:t=>new Uy(t,e==null?void 0:e.cacheSizeBytes)}}}function kP(n){return new RP(n==null?void 0:n.forceOwnership)}function CP(){return new PP}/**
 * @license
 * Copyright 2025 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const lI="NOT SUPPORTED";class Zn{constructor(e,t){this.hasPendingWrites=e,this.fromCache=t}isEqual(e){return this.hasPendingWrites===e.hasPendingWrites&&this.fromCache===e.fromCache}}class bt extends Go{constructor(e,t,r,s,i,o){super(e,t,r,s,o),this._firestore=e,this._firestoreImpl=e,this.metadata=i}exists(){return super.exists()}data(e={}){if(this._document){if(this._converter){const t=new tc(this._firestore,this._userDataWriter,this._key,this._document,this.metadata,null);return this._converter.fromFirestore(t,e)}return this._userDataWriter.convertValue(this._document.data.value,e.serverTimestamps)}}get(e,t={}){if(this._document){const r=this._document.data.field(Tn("DocumentSnapshot.get",e));if(r!==null)return this._userDataWriter.convertValue(r,t.serverTimestamps)}}toJSON(){if(this.metadata.hasPendingWrites)throw new D(k.FAILED_PRECONDITION,"DocumentSnapshot.toJSON() attempted to serialize a document with pending writes. Await waitForPendingWrites() before invoking toJSON().");const e=this._document,t={};return t.type=bt._jsonSchemaVersion,t.bundle="",t.bundleSource="DocumentSnapshot",t.bundleName=this._key.toString(),!e||!e.isValidDocument()||!e.isFoundDocument()?t:(this._userDataWriter.convertObjectMap(e.data.value.mapValue.fields,"previous"),t.bundle=(this._firestore,this.ref.path,"NOT SUPPORTED"),t)}}function vV(n,e,t){if(us(e,bt._jsonSchema)){if(e.bundle===lI)throw new D(k.INVALID_ARGUMENT,"The provided JSON object was created in a client environment, which is not supported.");const r=hs(n._databaseId),s=Ky(e.bundle,r),i=s.ju(),o=new Fh(s.getMetadata(),r);for(const h of i)o.Ja(h);const a=o.documents;if(a.length!==1)throw new D(k.INVALID_ARGUMENT,`Expected bundle data to contain 1 document, but it contains ${a.length} documents.`);const u=Jc(r,a[0].document),l=new B(oe.fromString(e.bundleName));return new bt(n,new cd(n),l,u,new Zn(!1,!1),t||null)}}bt._jsonSchemaVersion="firestore/documentSnapshot/1.0",bt._jsonSchema={type:Ke("string",bt._jsonSchemaVersion),bundleSource:Ke("string","DocumentSnapshot"),bundleName:Ke("string"),bundle:Ke("string")};class tc extends bt{data(e={}){return super.data(e)}}class St{constructor(e,t,r,s){this._firestore=e,this._userDataWriter=t,this._snapshot=s,this.metadata=new Zn(s.hasPendingWrites,s.fromCache),this.query=r}get docs(){const e=[];return this.forEach((t=>e.push(t))),e}get size(){return this._snapshot.docs.size}get empty(){return this.size===0}forEach(e,t){this._snapshot.docs.forEach((r=>{e.call(t,new tc(this._firestore,this._userDataWriter,r.key,r,new Zn(this._snapshot.mutatedKeys.has(r.key),this._snapshot.fromCache),this.query.converter))}))}docChanges(e={}){const t=!!e.includeMetadataChanges;if(t&&this._snapshot.excludesMetadataChanges)throw new D(k.INVALID_ARGUMENT,"To include metadata changes with your document changes, you must also pass { includeMetadataChanges:true } to onSnapshot().");return this._cachedChanges&&this._cachedChangesIncludeMetadataChanges===t||(this._cachedChanges=(function(s,i){if(s._snapshot.oldDocs.isEmpty()){let o=0;return s._snapshot.docChanges.map((a=>{const u=new tc(s._firestore,s._userDataWriter,a.doc.key,a.doc,new Zn(s._snapshot.mutatedKeys.has(a.doc.key),s._snapshot.fromCache),s.query.converter);return a.doc,{type:"added",doc:u,oldIndex:-1,newIndex:o++}}))}{let o=s._snapshot.oldDocs;return s._snapshot.docChanges.filter((a=>i||a.type!==3)).map((a=>{const u=new tc(s._firestore,s._userDataWriter,a.doc.key,a.doc,new Zn(s._snapshot.mutatedKeys.has(a.doc.key),s._snapshot.fromCache),s.query.converter);let l=-1,h=-1;return a.type!==0&&(l=o.indexOf(a.doc.key),o=o.delete(a.doc.key)),a.type!==1&&(o=o.add(a.doc),h=o.indexOf(a.doc.key)),{type:NP(a.type),doc:u,oldIndex:l,newIndex:h}}))}})(this,t),this._cachedChangesIncludeMetadataChanges=t),this._cachedChanges}toJSON(){if(this.metadata.hasPendingWrites)throw new D(k.FAILED_PRECONDITION,"QuerySnapshot.toJSON() attempted to serialize a document with pending writes. Await waitForPendingWrites() before invoking toJSON().");const e={};e.type=St._jsonSchemaVersion,e.bundleSource="QuerySnapshot",e.bundleName=eh.newId(),this._firestore._databaseId.database,this._firestore._databaseId.projectId;const t=[],r=[],s=[];return this.docs.forEach((i=>{i._document!==null&&(t.push(i._document),r.push(this._userDataWriter.convertObjectMap(i._document.data.value.mapValue.fields,"previous")),s.push(i.ref.path))})),e.bundle=(this._firestore,this.query._query,e.bundleName,"NOT SUPPORTED"),e}}function bV(n,e,t){if(us(e,St._jsonSchema)){if(e.bundle===lI)throw new D(k.INVALID_ARGUMENT,"The provided JSON object was created in a client environment, which is not supported.");const r=hs(n._databaseId),s=Ky(e.bundle,r),i=s.ju(),o=new Fh(s.getMetadata(),r);for(const p of i)o.Ja(p);if(o.queries.length!==1)throw new D(k.INVALID_ARGUMENT,`Snapshot data expected 1 query but found ${o.queries.length} queries.`);const a=Xc(o.queries[0].bundledQuery),u=o.documents;let l=new zr;u.map((p=>{const _=Jc(r,p.document);l=l.add(_)}));const h=rs.fromInitialDocuments(a,l,re(),!1,!1),f=new it(n,t||null,a);return new St(n,new cd(n),f,h)}}function NP(n){switch(n){case 0:return"added";case 2:case 3:return"modified";case 1:return"removed";default:return j(61501,{type:n})}}function SV(n,e){return n instanceof bt&&e instanceof bt?n._firestore===e._firestore&&n._key.isEqual(e._key)&&(n._document===null?e._document===null:n._document.isEqual(e._document))&&n._converter===e._converter:n instanceof St&&e instanceof St&&n._firestore===e._firestore&&Qy(n.query,e.query)&&n.metadata.isEqual(e.metadata)&&n._snapshot.isEqual(e._snapshot)}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */St._jsonSchemaVersion="firestore/querySnapshot/1.0",St._jsonSchema={type:Ke("string",St._jsonSchemaVersion),bundleSource:Ke("string","QuerySnapshot"),bundleName:Ke("string"),bundle:Ke("string")};const DP={maxAttempts:5};/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class VP{constructor(e,t){this._firestore=e,this._commitHandler=t,this._mutations=[],this._committed=!1,this._dataReader=ds(e)}set(e,t,r){this._verifyNotCommitted();const s=er(e,this._firestore),i=hu(s.converter,t,r),o=au(this._dataReader,"WriteBatch.set",s._key,i,s.converter!==null,r);return this._mutations.push(o.toMutation(s._key,Oe.none())),this}update(e,t,r,...s){this._verifyNotCommitted();const i=er(e,this._firestore);let o;return o=typeof(t=ge(t))=="string"||t instanceof bi?rd(this._dataReader,"WriteBatch.update",i._key,t,r,s):nd(this._dataReader,"WriteBatch.update",i._key,t),this._mutations.push(o.toMutation(i._key,Oe.exists(!0))),this}delete(e){this._verifyNotCommitted();const t=er(e,this._firestore);return this._mutations=this._mutations.concat(new yi(t._key,Oe.none())),this}commit(){return this._verifyNotCommitted(),this._committed=!0,this._mutations.length>0?this._commitHandler(this._mutations):Promise.resolve()}_verifyNotCommitted(){if(this._committed)throw new D(k.FAILED_PRECONDITION,"A write batch can no longer be used after commit() has been called.")}}function er(n,e){if((n=ge(n)).firestore!==e)throw new D(k.INVALID_ARGUMENT,"Provided document reference is from a different Firestore instance.");return n}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class OP{constructor(e,t){this._firestore=e,this._transaction=t,this._dataReader=ds(e)}get(e){const t=er(e,this._firestore),r=new cd(this._firestore);return this._transaction.lookup([t._key]).then((s=>{if(!s||s.length!==1)return j(24041);const i=s[0];if(i.isFoundDocument())return new Go(this._firestore,r,i.key,i,t.converter);if(i.isNoDocument())return new Go(this._firestore,r,t._key,null,t.converter);throw j(18433,{doc:i})}))}set(e,t,r){const s=er(e,this._firestore),i=hu(s.converter,t,r),o=au(this._dataReader,"Transaction.set",s._key,i,s.converter!==null,r);return this._transaction.set(s._key,o),this}update(e,t,r,...s){const i=er(e,this._firestore);let o;return o=typeof(t=ge(t))=="string"||t instanceof bi?rd(this._dataReader,"Transaction.update",i._key,t,r,s):nd(this._dataReader,"Transaction.update",i._key,t),this._transaction.update(i._key,o),this}delete(e){const t=er(e,this._firestore);return this._transaction.delete(t._key),this}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class xP extends OP{constructor(e,t){super(e,t),this._firestore=e}get(e){const t=er(e,this._firestore),r=new Ar(this._firestore);return super.get(e).then((s=>new bt(this._firestore,r,t._key,s._document,new Zn(!1,!1),t.converter)))}}function RV(n,e,t){n=ae(n,be);const r={...DP,...t};(function(o){if(o.maxAttempts<1)throw new D(k.INVALID_ARGUMENT,"Max attempts must be at least 1")})(r);const s=xe(n);return nP(s,(i=>e(new xP(n,i))),r)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Xe(n){n=ae(n,Ee);const e=ae(n.firestore,be),t=xe(e);return Gy(t,n._key).then((r=>ud(e,n,r)))}function PV(n){n=ae(n,Ee);const e=ae(n.firestore,be),t=xe(e),r=new Ar(e);return YR(t,n._key).then((s=>new bt(e,r,n._key,s,new Zn(s!==null&&s.hasLocalMutations,!0),n.converter)))}function kV(n){n=ae(n,Ee);const e=ae(n.firestore,be),t=xe(e);return Gy(t,n._key,{source:"server"}).then((r=>ud(e,n,r)))}function Y(n){n=ae(n,it);const e=ae(n.firestore,be),t=xe(e),r=new Ar(e);return oI(n._query),zy(t,n._query).then((s=>new St(e,r,n,s)))}function CV(n){n=ae(n,it);const e=ae(n.firestore,be),t=xe(e),r=new Ar(e);return XR(t,n._query).then((s=>new St(e,r,n,s)))}function NV(n){n=ae(n,it);const e=ae(n.firestore,be),t=xe(e),r=new Ar(e);return zy(t,n._query,{source:"server"}).then((s=>new St(e,r,n,s)))}function G(n,e,t){n=ae(n,Ee);const r=ae(n.firestore,be),s=hu(n.converter,e,t),i=ds(r);return da(r,[au(i,"setDoc",n._key,s,n.converter!==null,t).toMutation(n._key,Oe.none())])}function DV(n,e,t,...r){n=ae(n,Ee);const s=ae(n.firestore,be),i=ds(s);let o;return o=typeof(e=ge(e))=="string"||e instanceof bi?rd(i,"updateDoc",n._key,e,t,r):nd(i,"updateDoc",n._key,e),da(s,[o.toMutation(n._key,Oe.exists(!0))])}function me(n){return da(ae(n.firestore,be),[new yi(n._key,Oe.none())])}function X(n,e){const t=ae(n.firestore,be),r=We(n),s=hu(n.converter,e),i=ds(n.firestore);return da(t,[au(i,"addDoc",r._key,s,n.converter!==null,{}).toMutation(r._key,Oe.exists(!1))]).then((()=>r))}function zo(n,...e){var l,h,f;n=ge(n);let t={includeMetadataChanges:!1,source:"default"},r=0;typeof e[r]!="object"||Us(e[r])||(t=e[r++]);const s={includeMetadataChanges:t.includeMetadataChanges,source:t.source};if(Us(e[r])){const p=e[r];e[r]=(l=p.next)==null?void 0:l.bind(p),e[r+1]=(h=p.error)==null?void 0:h.bind(p),e[r+2]=(f=p.complete)==null?void 0:f.bind(p)}let i,o,a;if(n instanceof Ee)o=ae(n.firestore,be),a=gi(n._key.path),i={next:p=>{e[r]&&e[r](ud(o,n,p))},error:e[r+1],complete:e[r+2]};else{const p=ae(n,it);o=ae(p.firestore,be),a=p._query;const _=new Ar(o);i={next:w=>{e[r]&&e[r](new St(o,_,p,w))},error:e[r+1],complete:e[r+2]},oI(n._query)}const u=xe(o);return JR(u,a,s,i)}function VV(n,e,...t){const r=ge(n),s=(function(u){const l={bundle:"",bundleName:"",bundleSource:""},h=["bundle","bundleName","bundleSource"];for(const f of h){if(!(f in u)){l.error=`snapshotJson missing required field: ${f}`;break}const p=u[f];if(typeof p!="string"){l.error=`snapshotJson field '${f}' must be a string.`;break}if(p.length===0){l.error=`snapshotJson field '${f}' cannot be an empty string.`;break}f==="bundle"?l.bundle=p:f==="bundleName"?l.bundleName=p:f==="bundleSource"&&(l.bundleSource=p)}return l})(e);if(s.error)throw new D(k.INVALID_ARGUMENT,s.error);let i,o=0;if(typeof t[o]!="object"||Us(t[o])||(i=t[o++]),s.bundleSource==="QuerySnapshot"){let a=null;if(typeof t[o]=="object"&&Us(t[o])){const u=t[o++];a={next:u.next,error:u.error,complete:u.complete}}else a={next:t[o++],error:t[o++],complete:t[o++]};return(function(l,h,f,p,_){let w,b=!1;return ip(l,h.bundle).then((()=>fP(l,h.bundleName))).then((V=>{V&&!b&&(_&&V.withConverter(_),w=zo(V,f||{},p))})).catch((V=>(p.error&&p.error(V),()=>{}))),()=>{b||(b=!0,w&&w())}})(r,s,i,a,t[o])}if(s.bundleSource==="DocumentSnapshot"){let a=null;if(typeof t[o]=="object"&&Us(t[o])){const u=t[o++];a={next:u.next,error:u.error,complete:u.complete}}else a={next:t[o++],error:t[o++],complete:t[o++]};return(function(l,h,f,p,_){let w,b=!1;return ip(l,h.bundle).then((()=>{if(!b){const V=new Ee(l,_||null,B.fromPath(h.bundleName));w=zo(V,f||{},p)}})).catch((V=>(p.error&&p.error(V),()=>{}))),()=>{b||(b=!0,w&&w())}})(r,s,i,a,t[o])}throw new D(k.INVALID_ARGUMENT,`unsupported bundle source: ${s.bundleSource}`)}function OV(n,e){n=ae(n,be);const t=xe(n),r=Us(e)?e:{next:e};return tP(t,r)}function da(n,e){const t=xe(n);return eP(t,e)}function ud(n,e,t){const r=t.docs.get(e._key),s=new Ar(n);return new bt(n,s,e._key,r,new Zn(t.hasPendingWrites,t.fromCache),e.converter)}function pr(n){return n=ae(n,be),xe(n),new VP(n,(e=>da(n,e)))}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function xV(n,e){n=ae(n,be);const t=xe(n);if(!t._uninitializedComponentsProvider||t._uninitializedComponentsProvider._offline.kind==="memory")return Rt("Cannot enable indexes when persistence is disabled"),Promise.resolve();const r=(function(i){const o=typeof i=="string"?(function(l){try{return JSON.parse(l)}catch(h){throw new D(k.INVALID_ARGUMENT,"Failed to parse JSON: "+(h==null?void 0:h.message))}})(i):i,a=[];if(Array.isArray(o.indexes))for(const u of o.indexes){const l=lp(u,"collectionGroup"),h=[];if(Array.isArray(u.fields))for(const f of u.fields){const p=lp(f,"fieldPath"),_=id("setIndexConfiguration",p);f.arrayConfig==="CONTAINS"?h.push(new jr(_,2)):f.order==="ASCENDING"?h.push(new jr(_,0)):f.order==="DESCENDING"&&h.push(new jr(_,1))}a.push(new Ws(Ws.UNKNOWN_ID,l,h,Hs.empty()))}return a})(e);return iP(t,r)}function lp(n,e){if(typeof n[e]!="string")throw new D(k.INVALID_ARGUMENT,"Missing string value for: "+e);return n[e]}/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class MP{constructor(e){this._firestore=e,this.type="PersistentCacheIndexManager"}}function MV(n){var s;n=ae(n,be);const e=hp.get(n);if(e)return e;if(((s=xe(n)._uninitializedComponentsProvider)==null?void 0:s._offline.kind)!=="persistent")return null;const r=new MP(n);return hp.set(n,r),r}function LV(n){hI(n,!0)}function BV(n){hI(n,!1)}function FV(n){const e=xe(n._firestore);aP(e).then((t=>x("deleting all persistent cache indexes succeeded"))).catch((t=>Rt("deleting all persistent cache indexes failed",t)))}function hI(n,e){const t=xe(n._firestore);oP(t,e).then((r=>x(`setting persistent cache index auto creation isEnabled=${e} succeeded`))).catch((r=>Rt(`setting persistent cache index auto creation isEnabled=${e} failed`,r)))}const hp=new WeakMap;/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class UV{constructor(){throw new Error("instances of this class should not be created")}static onExistenceFilterMismatch(e){return ld.instance.onExistenceFilterMismatch(e)}}class ld{constructor(){this.t=new Map}static get instance(){return La||(La=new ld,Xb(La)),La}o(e){this.t.forEach((t=>t(e)))}onExistenceFilterMismatch(e){const t=Symbol(),r=this.t;return r.set(t,e),()=>r.delete(t)}}let La=null;(function(e,t=!0){Vv(as),Wr(new ar("firestore",((r,{instanceIdentifier:s,options:i})=>{const o=r.getProvider("app").getImmediate(),a=new be(new Mv(r.getProvider("auth-internal")),new Fv(o,r.getProvider("app-check-internal")),bb(o,s),o);return i={useFetchStreams:t,...i},a._setSettings(i),a}),"PUBLIC").setMultipleInstances(!0)),Xt(op,ap,e),Xt(op,ap,"esm2020")})();var LP="firebase",BP="12.14.0";/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */Xt(LP,BP,"app");/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const dI="firebasestorage.googleapis.com",fI="storageBucket",FP=120*1e3,UP=600*1e3;/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class $e extends un{constructor(e,t,r=0){super(Hu(e),`Firebase Storage: ${t} (${Hu(e)})`),this.status_=r,this.customData={serverResponse:null},this._baseMessage=this.message,Object.setPrototypeOf(this,$e.prototype)}get status(){return this.status_}set status(e){this.status_=e}_codeEquals(e){return Hu(e)===this.code}get serverResponse(){return this.customData.serverResponse}set serverResponse(e){this.customData.serverResponse=e,this.customData.serverResponse?this.message=`${this._baseMessage}
${this.customData.serverResponse}`:this.message=this._baseMessage}}var Ue;(function(n){n.UNKNOWN="unknown",n.OBJECT_NOT_FOUND="object-not-found",n.BUCKET_NOT_FOUND="bucket-not-found",n.PROJECT_NOT_FOUND="project-not-found",n.QUOTA_EXCEEDED="quota-exceeded",n.UNAUTHENTICATED="unauthenticated",n.UNAUTHORIZED="unauthorized",n.UNAUTHORIZED_APP="unauthorized-app",n.RETRY_LIMIT_EXCEEDED="retry-limit-exceeded",n.INVALID_CHECKSUM="invalid-checksum",n.CANCELED="canceled",n.INVALID_EVENT_NAME="invalid-event-name",n.INVALID_URL="invalid-url",n.INVALID_DEFAULT_BUCKET="invalid-default-bucket",n.NO_DEFAULT_BUCKET="no-default-bucket",n.CANNOT_SLICE_BLOB="cannot-slice-blob",n.SERVER_FILE_WRONG_SIZE="server-file-wrong-size",n.NO_DOWNLOAD_URL="no-download-url",n.INVALID_ARGUMENT="invalid-argument",n.INVALID_ARGUMENT_COUNT="invalid-argument-count",n.APP_DELETED="app-deleted",n.INVALID_ROOT_OPERATION="invalid-root-operation",n.INVALID_FORMAT="invalid-format",n.INTERNAL_ERROR="internal-error",n.UNSUPPORTED_ENVIRONMENT="unsupported-environment"})(Ue||(Ue={}));function Hu(n){return"storage/"+n}function hd(){const n="An unknown error occurred, please check the error payload for server response.";return new $e(Ue.UNKNOWN,n)}function $P(n){return new $e(Ue.OBJECT_NOT_FOUND,"Object '"+n+"' does not exist.")}function qP(n){return new $e(Ue.QUOTA_EXCEEDED,"Quota for bucket '"+n+"' exceeded, please view quota on https://firebase.google.com/pricing/.")}function jP(){const n="User is not authenticated, please authenticate using Firebase Authentication and try again.";return new $e(Ue.UNAUTHENTICATED,n)}function GP(){return new $e(Ue.UNAUTHORIZED_APP,"This app does not have permission to access Firebase Storage on this project.")}function zP(n){return new $e(Ue.UNAUTHORIZED,"User does not have permission to access '"+n+"'.")}function KP(){return new $e(Ue.RETRY_LIMIT_EXCEEDED,"Max retry time for operation exceeded, please try again.")}function WP(){return new $e(Ue.CANCELED,"User canceled the upload/download.")}function HP(n){return new $e(Ue.INVALID_URL,"Invalid URL '"+n+"'.")}function QP(n){return new $e(Ue.INVALID_DEFAULT_BUCKET,"Invalid default bucket '"+n+"'.")}function JP(){return new $e(Ue.NO_DEFAULT_BUCKET,"No default bucket found. Did you set the '"+fI+"' property when initializing the app?")}function YP(){return new $e(Ue.CANNOT_SLICE_BLOB,"Cannot slice blob for upload. Please retry the upload.")}function XP(){return new $e(Ue.NO_DOWNLOAD_URL,"The given file does not have any download URLs.")}function ZP(n){return new $e(Ue.UNSUPPORTED_ENVIRONMENT,`${n} is missing. Make sure to install the required polyfills. See https://firebase.google.com/docs/web/environments-js-sdk#polyfills for more information.`)}function Ol(n){return new $e(Ue.INVALID_ARGUMENT,n)}function mI(){return new $e(Ue.APP_DELETED,"The Firebase app was deleted.")}function ek(n){return new $e(Ue.INVALID_ROOT_OPERATION,"The operation '"+n+"' cannot be performed on a root reference, create a non-root reference using child, such as .child('file.png').")}function bo(n,e){return new $e(Ue.INVALID_FORMAT,"String does not match format '"+n+"': "+e)}function oo(n){throw new $e(Ue.INTERNAL_ERROR,"Internal error: "+n)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class vt{constructor(e,t){this.bucket=e,this.path_=t}get path(){return this.path_}get isRoot(){return this.path.length===0}fullServerUrl(){const e=encodeURIComponent;return"/b/"+e(this.bucket)+"/o/"+e(this.path)}bucketOnlyServerUrl(){return"/b/"+encodeURIComponent(this.bucket)+"/o"}static makeFromBucketSpec(e,t){let r;try{r=vt.makeFromUrl(e,t)}catch{return new vt(e,"")}if(r.path==="")return r;throw QP(e)}static makeFromUrl(e,t){let r=null;const s="([A-Za-z0-9.\\-_]+)";function i(z){z.path.charAt(z.path.length-1)==="/"&&(z.path_=z.path_.slice(0,-1))}const o="(/(.*))?$",a=new RegExp("^gs://"+s+o,"i"),u={bucket:1,path:3};function l(z){z.path_=decodeURIComponent(z.path)}const h="v[A-Za-z0-9_]+",f=t.replace(/[.]/g,"\\."),p="(/([^?#]*).*)?$",_=new RegExp(`^https?://${f}/${h}/b/${s}/o${p}`,"i"),w={bucket:1,path:3},b=t===dI?"(?:storage.googleapis.com|storage.cloud.google.com)":t,C="([^?#]*)",V=new RegExp(`^https?://${b}/${s}/${C}`,"i"),L=[{regex:a,indices:u,postModify:i},{regex:_,indices:w,postModify:l},{regex:V,indices:{bucket:1,path:2},postModify:l}];for(let z=0;z<L.length;z++){const ne=L[z],H=ne.regex.exec(e);if(H){const T=H[ne.indices.bucket];let y=H[ne.indices.path];y||(y=""),r=new vt(T,y),ne.postModify(r);break}}if(r==null)throw HP(e);return r}}class tk{constructor(e){this.promise_=Promise.reject(e)}getPromise(){return this.promise_}cancel(e=!1){}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function nk(n,e,t){let r=1,s=null,i=null,o=!1,a=0;function u(){return a===2}let l=!1;function h(...C){l||(l=!0,e.apply(null,C))}function f(C){s=setTimeout(()=>{s=null,n(_,u())},C)}function p(){i&&clearTimeout(i)}function _(C,...V){if(l){p();return}if(C){p(),h.call(null,C,...V);return}if(u()||o){p(),h.call(null,C,...V);return}r<64&&(r*=2);let L;a===1?(a=2,L=0):L=(r+Math.random())*1e3,f(L)}let w=!1;function b(C){w||(w=!0,p(),!l&&(s!==null?(C||(a=2),clearTimeout(s),f(0)):C||(a=1)))}return f(0),i=setTimeout(()=>{o=!0,b(!0)},t),b}function rk(n){n(!1)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function sk(n){return n!==void 0}function ik(n){return typeof n=="object"&&!Array.isArray(n)}function dd(n){return typeof n=="string"||n instanceof String}function dp(n){return fd()&&n instanceof Blob}function fd(){return typeof Blob<"u"}function fp(n,e,t,r){if(r<e)throw Ol(`Invalid value for '${n}'. Expected ${e} or greater.`);if(r>t)throw Ol(`Invalid value for '${n}'. Expected ${t} or less.`)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function md(n,e,t){let r=e;return t==null&&(r=`https://${e}`),`${t}://${r}/v0${n}`}function pI(n){const e=encodeURIComponent;let t="?";for(const r in n)if(n.hasOwnProperty(r)){const s=e(r)+"="+e(n[r]);t=t+s+"&"}return t=t.slice(0,-1),t}var Kr;(function(n){n[n.NO_ERROR=0]="NO_ERROR",n[n.NETWORK_ERROR=1]="NETWORK_ERROR",n[n.ABORT=2]="ABORT"})(Kr||(Kr={}));/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function ok(n,e){const t=n>=500&&n<600,s=[408,429].indexOf(n)!==-1,i=e.indexOf(n)!==-1;return t||s||i}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ak{constructor(e,t,r,s,i,o,a,u,l,h,f,p=!0,_=!1){this.url_=e,this.method_=t,this.headers_=r,this.body_=s,this.successCodes_=i,this.additionalRetryCodes_=o,this.callback_=a,this.errorCallback_=u,this.timeout_=l,this.progressCallback_=h,this.connectionFactory_=f,this.retry=p,this.isUsingEmulator=_,this.pendingConnection_=null,this.backoffId_=null,this.canceled_=!1,this.appDelete_=!1,this.promise_=new Promise((w,b)=>{this.resolve_=w,this.reject_=b,this.start_()})}start_(){const e=(r,s)=>{if(s){r(!1,new Ba(!1,null,!0));return}const i=this.connectionFactory_();this.pendingConnection_=i;const o=a=>{const u=a.loaded,l=a.lengthComputable?a.total:-1;this.progressCallback_!==null&&this.progressCallback_(u,l)};this.progressCallback_!==null&&i.addUploadProgressListener(o),i.send(this.url_,this.method_,this.isUsingEmulator,this.body_,this.headers_).then(()=>{this.progressCallback_!==null&&i.removeUploadProgressListener(o),this.pendingConnection_=null;const a=i.getErrorCode()===Kr.NO_ERROR,u=i.getStatus();if(!a||ok(u,this.additionalRetryCodes_)&&this.retry){const h=i.getErrorCode()===Kr.ABORT;r(!1,new Ba(!1,null,h));return}const l=this.successCodes_.indexOf(u)!==-1;r(!0,new Ba(l,i))})},t=(r,s)=>{const i=this.resolve_,o=this.reject_,a=s.connection;if(s.wasSuccessCode)try{const u=this.callback_(a,a.getResponse());sk(u)?i(u):i()}catch(u){o(u)}else if(a!==null){const u=hd();u.serverResponse=a.getErrorText(),this.errorCallback_?o(this.errorCallback_(a,u)):o(u)}else if(s.canceled){const u=this.appDelete_?mI():WP();o(u)}else{const u=KP();o(u)}};this.canceled_?t(!1,new Ba(!1,null,!0)):this.backoffId_=nk(e,t,this.timeout_)}getPromise(){return this.promise_}cancel(e){this.canceled_=!0,this.appDelete_=e||!1,this.backoffId_!==null&&rk(this.backoffId_),this.pendingConnection_!==null&&this.pendingConnection_.abort()}}class Ba{constructor(e,t,r){this.wasSuccessCode=e,this.connection=t,this.canceled=!!r}}function ck(n,e){e!==null&&e.length>0&&(n.Authorization="Firebase "+e)}function uk(n,e){n["X-Firebase-Storage-Version"]="webjs/"+(e??"AppManager")}function lk(n,e){e&&(n["X-Firebase-GMPID"]=e)}function hk(n,e){e!==null&&(n["X-Firebase-AppCheck"]=e)}function dk(n,e,t,r,s,i,o=!0,a=!1){const u=pI(n.urlParams),l=n.url+u,h=Object.assign({},n.headers);return lk(h,e),ck(h,t),uk(h,i),hk(h,r),new ak(l,n.method,h,n.body,n.successCodes,n.additionalRetryCodes,n.handler,n.errorHandler,n.timeout,n.progressCallback,s,o,a)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function fk(){return typeof BlobBuilder<"u"?BlobBuilder:typeof WebKitBlobBuilder<"u"?WebKitBlobBuilder:void 0}function mk(...n){const e=fk();if(e!==void 0){const t=new e;for(let r=0;r<n.length;r++)t.append(n[r]);return t.getBlob()}else{if(fd())return new Blob(n);throw new $e(Ue.UNSUPPORTED_ENVIRONMENT,"This browser doesn't seem to support creating Blobs")}}function pk(n,e,t){return n.webkitSlice?n.webkitSlice(e,t):n.mozSlice?n.mozSlice(e,t):n.slice?n.slice(e,t):null}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function gk(n){if(typeof atob>"u")throw ZP("base-64");return atob(n)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Yt={RAW:"raw",BASE64:"base64",BASE64URL:"base64url",DATA_URL:"data_url"};class Qu{constructor(e,t){this.data=e,this.contentType=t||null}}function _k(n,e){switch(n){case Yt.RAW:return new Qu(gI(e));case Yt.BASE64:case Yt.BASE64URL:return new Qu(_I(n,e));case Yt.DATA_URL:return new Qu(Ik(e),wk(e))}throw hd()}function gI(n){const e=[];for(let t=0;t<n.length;t++){let r=n.charCodeAt(t);if(r<=127)e.push(r);else if(r<=2047)e.push(192|r>>6,128|r&63);else if((r&64512)===55296)if(!(t<n.length-1&&(n.charCodeAt(t+1)&64512)===56320))e.push(239,191,189);else{const i=r,o=n.charCodeAt(++t);r=65536|(i&1023)<<10|o&1023,e.push(240|r>>18,128|r>>12&63,128|r>>6&63,128|r&63)}else(r&64512)===56320?e.push(239,191,189):e.push(224|r>>12,128|r>>6&63,128|r&63)}return new Uint8Array(e)}function yk(n){let e;try{e=decodeURIComponent(n)}catch{throw bo(Yt.DATA_URL,"Malformed data URL.")}return gI(e)}function _I(n,e){switch(n){case Yt.BASE64:{const s=e.indexOf("-")!==-1,i=e.indexOf("_")!==-1;if(s||i)throw bo(n,"Invalid character '"+(s?"-":"_")+"' found: is it base64url encoded?");break}case Yt.BASE64URL:{const s=e.indexOf("+")!==-1,i=e.indexOf("/")!==-1;if(s||i)throw bo(n,"Invalid character '"+(s?"+":"/")+"' found: is it base64 encoded?");e=e.replace(/-/g,"+").replace(/_/g,"/");break}}let t;try{t=gk(e)}catch(s){throw s.message.includes("polyfill")?s:bo(n,"Invalid character found")}const r=new Uint8Array(t.length);for(let s=0;s<t.length;s++)r[s]=t.charCodeAt(s);return r}class yI{constructor(e){this.base64=!1,this.contentType=null;const t=e.match(/^data:([^,]+)?,/);if(t===null)throw bo(Yt.DATA_URL,"Must be formatted 'data:[<mediatype>][;base64],<data>");const r=t[1]||null;r!=null&&(this.base64=Ek(r,";base64"),this.contentType=this.base64?r.substring(0,r.length-7):r),this.rest=e.substring(e.indexOf(",")+1)}}function Ik(n){const e=new yI(n);return e.base64?_I(Yt.BASE64,e.rest):yk(e.rest)}function wk(n){return new yI(n).contentType}function Ek(n,e){return n.length>=e.length?n.substring(n.length-e.length)===e:!1}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Yn{constructor(e,t){let r=0,s="";dp(e)?(this.data_=e,r=e.size,s=e.type):e instanceof ArrayBuffer?(t?this.data_=new Uint8Array(e):(this.data_=new Uint8Array(e.byteLength),this.data_.set(new Uint8Array(e))),r=this.data_.length):e instanceof Uint8Array&&(t?this.data_=e:(this.data_=new Uint8Array(e.length),this.data_.set(e)),r=e.length),this.size_=r,this.type_=s}size(){return this.size_}type(){return this.type_}slice(e,t){if(dp(this.data_)){const r=this.data_,s=pk(r,e,t);return s===null?null:new Yn(s)}else{const r=new Uint8Array(this.data_.buffer,e,t-e);return new Yn(r,!0)}}static getBlob(...e){if(fd()){const t=e.map(r=>r instanceof Yn?r.data_:r);return new Yn(mk.apply(null,t))}else{const t=e.map(o=>dd(o)?_k(Yt.RAW,o).data:o.data_);let r=0;t.forEach(o=>{r+=o.byteLength});const s=new Uint8Array(r);let i=0;return t.forEach(o=>{for(let a=0;a<o.length;a++)s[i++]=o[a]}),new Yn(s,!0)}}uploadData(){return this.data_}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function II(n){let e;try{e=JSON.parse(n)}catch{return null}return ik(e)?e:null}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Tk(n){if(n.length===0)return null;const e=n.lastIndexOf("/");return e===-1?"":n.slice(0,e)}function Ak(n,e){const t=e.split("/").filter(r=>r.length>0).join("/");return n.length===0?t:n+"/"+t}function wI(n){const e=n.lastIndexOf("/",n.length-2);return e===-1?n:n.slice(e+1)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function vk(n,e){return e}class pt{constructor(e,t,r,s){this.server=e,this.local=t||e,this.writable=!!r,this.xform=s||vk}}let Fa=null;function bk(n){return!dd(n)||n.length<2?n:wI(n)}function EI(){if(Fa)return Fa;const n=[];n.push(new pt("bucket")),n.push(new pt("generation")),n.push(new pt("metageneration")),n.push(new pt("name","fullPath",!0));function e(i,o){return bk(o)}const t=new pt("name");t.xform=e,n.push(t);function r(i,o){return o!==void 0?Number(o):o}const s=new pt("size");return s.xform=r,n.push(s),n.push(new pt("timeCreated")),n.push(new pt("updated")),n.push(new pt("md5Hash",null,!0)),n.push(new pt("cacheControl",null,!0)),n.push(new pt("contentDisposition",null,!0)),n.push(new pt("contentEncoding",null,!0)),n.push(new pt("contentLanguage",null,!0)),n.push(new pt("contentType",null,!0)),n.push(new pt("metadata","customMetadata",!0)),Fa=n,Fa}function Sk(n,e){function t(){const r=n.bucket,s=n.fullPath,i=new vt(r,s);return e._makeStorageReference(i)}Object.defineProperty(n,"ref",{get:t})}function Rk(n,e,t){const r={};r.type="file";const s=t.length;for(let i=0;i<s;i++){const o=t[i];r[o.local]=o.xform(r,e[o.server])}return Sk(r,n),r}function TI(n,e,t){const r=II(e);return r===null?null:Rk(n,r,t)}function Pk(n,e,t,r){const s=II(e);if(s===null||!dd(s.downloadTokens))return null;const i=s.downloadTokens;if(i.length===0)return null;const o=encodeURIComponent;return i.split(",").map(l=>{const h=n.bucket,f=n.fullPath,p="/b/"+o(h)+"/o/"+o(f),_=md(p,t,r),w=pI({alt:"media",token:l});return _+w})[0]}function kk(n,e){const t={},r=e.length;for(let s=0;s<r;s++){const i=e[s];i.writable&&(t[i.server]=n[i.local])}return JSON.stringify(t)}class AI{constructor(e,t,r,s){this.url=e,this.method=t,this.handler=r,this.timeout=s,this.urlParams={},this.headers={},this.body=null,this.errorHandler=null,this.progressCallback=null,this.successCodes=[200],this.additionalRetryCodes=[]}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function vI(n){if(!n)throw hd()}function Ck(n,e){function t(r,s){const i=TI(n,s,e);return vI(i!==null),i}return t}function Nk(n,e){function t(r,s){const i=TI(n,s,e);return vI(i!==null),Pk(i,s,n.host,n._protocol)}return t}function bI(n){function e(t,r){let s;return t.getStatus()===401?t.getErrorText().includes("Firebase App Check token is invalid")?s=GP():s=jP():t.getStatus()===402?s=qP(n.bucket):t.getStatus()===403?s=zP(n.path):s=r,s.status=t.getStatus(),s.serverResponse=r.serverResponse,s}return e}function Dk(n){const e=bI(n);function t(r,s){let i=e(r,s);return r.getStatus()===404&&(i=$P(n.path)),i.serverResponse=s.serverResponse,i}return t}function Vk(n,e,t){const r=e.fullServerUrl(),s=md(r,n.host,n._protocol),i="GET",o=n.maxOperationRetryTime,a=new AI(s,i,Nk(n,t),o);return a.errorHandler=Dk(e),a}function Ok(n,e){return n&&n.contentType||e&&e.type()||"application/octet-stream"}function xk(n,e,t){const r=Object.assign({},t);return r.fullPath=n.path,r.size=e.size(),r.contentType||(r.contentType=Ok(null,e)),r}function Mk(n,e,t,r,s){const i=e.bucketOnlyServerUrl(),o={"X-Goog-Upload-Protocol":"multipart"};function a(){let L="";for(let z=0;z<2;z++)L=L+Math.random().toString().slice(2);return L}const u=a();o["Content-Type"]="multipart/related; boundary="+u;const l=xk(e,r,s),h=kk(l,t),f="--"+u+`\r
Content-Type: application/json; charset=utf-8\r
\r
`+h+`\r
--`+u+`\r
Content-Type: `+l.contentType+`\r
\r
`,p=`\r
--`+u+"--",_=Yn.getBlob(f,r,p);if(_===null)throw YP();const w={name:l.fullPath},b=md(i,n.host,n._protocol),C="POST",V=n.maxUploadRetryTime,O=new AI(b,C,Ck(n,t),V);return O.urlParams=w,O.headers=o,O.body=_.uploadData(),O.errorHandler=bI(e),O}class Lk{constructor(){this.sent_=!1,this.xhr_=new XMLHttpRequest,this.initXhr(),this.errorCode_=Kr.NO_ERROR,this.sendPromise_=new Promise(e=>{this.xhr_.addEventListener("abort",()=>{this.errorCode_=Kr.ABORT,e()}),this.xhr_.addEventListener("error",()=>{this.errorCode_=Kr.NETWORK_ERROR,e()}),this.xhr_.addEventListener("load",()=>{e()})})}send(e,t,r,s,i){if(this.sent_)throw oo("cannot .send() more than once");if(gr(e)&&r&&(this.xhr_.withCredentials=!0),this.sent_=!0,this.xhr_.open(t,e,!0),i!==void 0)for(const o in i)i.hasOwnProperty(o)&&this.xhr_.setRequestHeader(o,i[o].toString());return s!==void 0?this.xhr_.send(s):this.xhr_.send(),this.sendPromise_}getErrorCode(){if(!this.sent_)throw oo("cannot .getErrorCode() before sending");return this.errorCode_}getStatus(){if(!this.sent_)throw oo("cannot .getStatus() before sending");try{return this.xhr_.status}catch{return-1}}getResponse(){if(!this.sent_)throw oo("cannot .getResponse() before sending");return this.xhr_.response}getErrorText(){if(!this.sent_)throw oo("cannot .getErrorText() before sending");return this.xhr_.statusText}abort(){this.xhr_.abort()}getResponseHeader(e){return this.xhr_.getResponseHeader(e)}addUploadProgressListener(e){this.xhr_.upload!=null&&this.xhr_.upload.addEventListener("progress",e)}removeUploadProgressListener(e){this.xhr_.upload!=null&&this.xhr_.upload.removeEventListener("progress",e)}}class Bk extends Lk{initXhr(){this.xhr_.responseType="text"}}function SI(){return new Bk}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ss{constructor(e,t){this._service=e,t instanceof vt?this._location=t:this._location=vt.makeFromUrl(t,e.host)}toString(){return"gs://"+this._location.bucket+"/"+this._location.path}_newRef(e,t){return new ss(e,t)}get root(){const e=new vt(this._location.bucket,"");return this._newRef(this._service,e)}get bucket(){return this._location.bucket}get fullPath(){return this._location.path}get name(){return wI(this._location.path)}get storage(){return this._service}get parent(){const e=Tk(this._location.path);if(e===null)return null;const t=new vt(this._location.bucket,e);return new ss(this._service,t)}_throwIfRoot(e){if(this._location.path==="")throw ek(e)}}function Fk(n,e,t){n._throwIfRoot("uploadBytes");const r=Mk(n.storage,n._location,EI(),new Yn(e,!0),t);return n.storage.makeRequestWithTokens(r,SI).then(s=>({metadata:s,ref:n}))}function Uk(n){n._throwIfRoot("getDownloadURL");const e=Vk(n.storage,n._location,EI());return n.storage.makeRequestWithTokens(e,SI).then(t=>{if(t===null)throw XP();return t})}function $k(n,e){const t=Ak(n._location.path,e),r=new vt(n._location.bucket,t);return new ss(n.storage,r)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function qk(n){return/^[A-Za-z]+:\/\//.test(n)}function jk(n,e){return new ss(n,e)}function RI(n,e){if(n instanceof pd){const t=n;if(t._bucket==null)throw JP();const r=new ss(t,t._bucket);return e!=null?RI(r,e):r}else return e!==void 0?$k(n,e):n}function Gk(n,e){if(e&&qk(e)){if(n instanceof pd)return jk(n,e);throw Ol("To use ref(service, url), the first argument must be a Storage instance.")}else return RI(n,e)}function mp(n,e){const t=e==null?void 0:e[fI];return t==null?null:vt.makeFromBucketSpec(t,n)}function zk(n,e,t,r={}){n.host=`${e}:${t}`;const s=gr(e);s&&Dc(`https://${n.host}/b`),n._isUsingEmulator=!0,n._protocol=s?"https":"http";const{mockUserToken:i}=r;i&&(n._overrideAuthToken=typeof i=="string"?i:Mp(i,n.app.options.projectId))}class pd{constructor(e,t,r,s,i,o=!1){this.app=e,this._authProvider=t,this._appCheckProvider=r,this._url=s,this._firebaseVersion=i,this._isUsingEmulator=o,this._bucket=null,this._host=dI,this._protocol="https",this._appId=null,this._deleted=!1,this._maxOperationRetryTime=FP,this._maxUploadRetryTime=UP,this._requests=new Set,s!=null?this._bucket=vt.makeFromBucketSpec(s,this._host):this._bucket=mp(this._host,this.app.options)}get host(){return this._host}set host(e){this._host=e,this._url!=null?this._bucket=vt.makeFromBucketSpec(this._url,e):this._bucket=mp(e,this.app.options)}get maxUploadRetryTime(){return this._maxUploadRetryTime}set maxUploadRetryTime(e){fp("time",0,Number.POSITIVE_INFINITY,e),this._maxUploadRetryTime=e}get maxOperationRetryTime(){return this._maxOperationRetryTime}set maxOperationRetryTime(e){fp("time",0,Number.POSITIVE_INFINITY,e),this._maxOperationRetryTime=e}async _getAuthToken(){if(this._overrideAuthToken)return this._overrideAuthToken;const e=this._authProvider.getImmediate({optional:!0});if(e){const t=await e.getToken();if(t!==null)return t.accessToken}return null}async _getAppCheckToken(){if(Ct(this.app)&&this.app.settings.appCheckToken)return this.app.settings.appCheckToken;const e=this._appCheckProvider.getImmediate({optional:!0});return e?(await e.getToken()).token:null}_delete(){return this._deleted||(this._deleted=!0,this._requests.forEach(e=>e.cancel()),this._requests.clear()),Promise.resolve()}_makeStorageReference(e){return new ss(this,e)}_makeRequest(e,t,r,s,i=!0){if(this._deleted)return new tk(mI());{const o=dk(e,this._appId,r,s,t,this._firebaseVersion,i,this._isUsingEmulator);return this._requests.add(o),o.getPromise().then(()=>this._requests.delete(o),()=>this._requests.delete(o)),o}}async makeRequestWithTokens(e,t){const[r,s]=await Promise.all([this._getAuthToken(),this._getAppCheckToken()]);return this._makeRequest(e,t,r,s).getPromise()}}const pp="@firebase/storage",gp="0.14.3";/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const PI="storage";function Kk(n,e,t){return n=ge(n),Fk(n,e,t)}function Wk(n){return n=ge(n),Uk(n)}function Hk(n,e){return n=ge(n),Gk(n,e)}function Qk(n=Vc(),e){n=ge(n);const r=fi(n,PI).getImmediate({identifier:e}),s=Vp("storage");return s&&Jk(r,...s),r}function Jk(n,e,t,r={}){zk(n,e,t,r)}function Yk(n,{instanceIdentifier:e}){const t=n.getProvider("app").getImmediate(),r=n.getProvider("auth-internal"),s=n.getProvider("app-check-internal");return new pd(t,r,s,e,as)}function Xk(){Wr(new ar(PI,Yk,"PUBLIC").setMultipleInstances(!0)),Xt(pp,gp,""),Xt(pp,gp,"esm2020")}Xk();const Zk={apiKey:"AIzaSyBovPiw_bjCnrd-6le5mPoOBME-N-6aPbs",authDomain:"saudi-property-manager.firebaseapp.com",projectId:"saudi-property-manager",storageBucket:"saudi-property-manager.firebasestorage.app",messagingSenderId:"854165833434",appId:"1:854165833434:web:bc550b5c79266bd1fb07e3"},is=uT().length>0?Vc():jp(Zk);function eC(){try{return dP(is,{localCache:SP({tabManager:CP()}),ignoreUndefinedProperties:!0})}catch{return Qh(is)}}const tC=eC();function nC(){return Qh(is)}const rC=Nv(is),kI=Qk(is),$V=Object.freeze(Object.defineProperty({__proto__:null,app:is,auth:rC,db:tC,getDb:nC,storage:kI},Symbol.toStringTag,{value:"Module"})),sC=n=>n.replace(/[.*+?^${}()|[\]\\]/g,"\\$&"),xl=n=>{if(!n)return new Date().getFullYear();const e=new Date(n);return Number.isNaN(e.getTime())?new Date().getFullYear():e.getFullYear()},iC=(n,e,t="")=>{const r=xl(e),s=new RegExp(`^${sC(t)}${r}-(\\d+)$`);let i=0;(n||[]).forEach(a=>{const u=String((a==null?void 0:a.vatInvoiceNumber)||"").trim();if(!u)return;const l=u.match(s);if(!l)return;const h=Number(l[1]);Number.isFinite(h)&&h>i&&(i=h)});const o=String(i+1).padStart(2,"0");return`${t}${r}-${o}`},qV=(n,e)=>{const t=xl(e),r=new RegExp(`^${t}-(\\d+)$`),s=/^SV-(\d+)$/i;let i=0;return(n||[]).forEach(o=>{var p;if(xl(o==null?void 0:o.date)!==t)return;const a=String((o==null?void 0:o.vatInvoiceNumber)||"").trim();if(!a)return;const u=a.match(s),l=a.match(/^(\d+)$/),h=a.match(r),f=Number((p=u||l||h)==null?void 0:p[1]);Number.isFinite(f)&&f>i&&(i=f)}),`SV-${i+1}`};var CI=(n=>(n.ADMIN="ADMIN",n.ENGINEER="ENGINEER",n.EMPLOYEE="EMPLOYEE",n.MANAGER="MANAGER",n.OWNER="OWNER",n))(CI||{}),$s=(n=>(n.INCOME="INCOME",n.EXPENSE="EXPENSE",n.INFO="INFO",n))($s||{}),kt=(n=>(n.GENERAL="General Expense",n.HEAD="Head Office",n.SALARY="Salary",n.BORROWING="Borrowing",n.OWNER_EXPENSE="Owner Expense",n.MAINTENANCE="Maintenance",n.UTILITIES="Utilities",n.VENDOR_PAYMENT="Vendor Payment",n.PROPERTY_RENT="Property Rent",n.SERVICE_AGREEMENT="Service Agreement",n))(kt||{}),tr=(n=>(n.CASH="CASH",n.BANK="BANK",n.CHEQUE="CHEQUE",n))(tr||{}),gd=(n=>(n.APPROVED="APPROVED",n.PENDING="PENDING",n.REJECTED="REJECTED",n))(gd||{}),oC=(n=>(n.TODO="TODO",n.IN_PROGRESS="IN_PROGRESS",n.DONE="DONE",n))(oC||{});const NI=/^\$?([A-Z]+)\$?([1-9]\d*)$/i;function _d(n){const e=String(n||"").trim().toUpperCase();let t=0;for(const r of e){const s=r.charCodeAt(0);if(s<65||s>90)throw new Error(`Invalid column label: ${n}`);t=t*26+(s-64)}return t}function aC(n){let e=Math.floor(Number(n));if(!Number.isFinite(e)||e<1)throw new Error(`Invalid column index: ${n}`);let t="";for(;e>0;){const r=(e-1)%26;t=String.fromCharCode(65+r)+t,e=Math.floor((e-1)/26)}return t}function yd(n){const e=nc(n);return ms(e.col,e.row)}function nc(n){const e=String(n||"").trim().match(NI);if(!e)throw new Error(`Invalid cell address: ${n}`);return{col:_d(e[1]),row:Number(e[2])}}function ms(n,e){return`${aC(n)}${Math.floor(e)}`}function _p(n){return NI.test(String(n||"").trim())}function cC(n){const[e,t]=String(n||"").split(":");if(!e||!t){const i=nc(n);return{start:i,end:i}}const r=nc(e),s=nc(t);return{start:{col:Math.min(r.col,s.col),row:Math.min(r.row,s.row)},end:{col:Math.max(r.col,s.col),row:Math.max(r.row,s.row)}}}function uC(n,e=1e4){const t=cC(n),r=t.end.col-t.start.col+1,s=t.end.row-t.start.row+1;if(r*s>e)throw new Error(`Range too large: ${n}`);const i=[];for(let o=t.start.row;o<=t.end.row;o++)for(let a=t.start.col;a<=t.end.col;a++)i.push(ms(a,o));return i}const ct=n=>String(n||"").toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g,"");function An(n){return n==="income"?"rentalIncome":n||"rentalIncome"}function yp(n){const e=ct(n);return e?e.includes("building")||e.includes("property")||e.includes("مبنى")||e.includes("عمارة")?"BUILDING":e.includes("head")||e.includes("office")||e.includes("treasury")||e.includes("مكتب")||e.includes("خزين")?"HEAD_OFFICE":e.includes("owner")||e.includes("مالك")?"OWNER":"":""}function Re(n,e,t){if(!e)return"";const r=ms(_d(e),t),s=n.cells[r],i=(s==null?void 0:s.value)??(s==null?void 0:s.raw)??"";return String(i??"").trim()}function Ua(n,e,t){const r=Re(n,e,t).replace(/,/g,""),s=Number(r);return Number.isFinite(s)?s:0}function lC(n,e){const t=ct(n);return t?t.includes("rent")||t.includes("ايجار")||t.includes("إيجار")?"RENT":t.includes("salary")||t.includes("راتب")?"SALARY":t.includes("borrow")?"BORROWING":t.includes("owner")?"OWNER_EXPENSE":t.includes("income")?"OTHER_INCOME":t.includes("expense")||t.includes("مصروف")?"EXPENSE":e:e}function ao(n,e){return ct(n)===ct(e)}function Ip(n){const e=ct(n);return e.includes("cash")||e.includes("نقد")?tr.CASH:e.includes("cheque")||e.includes("check")?tr.CHEQUE:tr.BANK}function wp(n,e){const t=ct(e);return t&&n.find(r=>{const s=r,i=s._rawBuildingId||s.rawId||"",o=s._bookDisplayName||s.bookName||"",a=s._sourceBookId||s.bookId||"";return[r.id,i,r.name,o?`${r.name} ${o}`:"",a?`${r.name} ${a}`:""].map(ct).filter(Boolean).some(l=>l===t||l.includes(t)||t.includes(l))})||null}function Ep(n,e){const t=ct(e);return t&&n.find(r=>r.id===e||ct(r.name)===t||ct(r.name).includes(t)||t.includes(ct(r.name)))||null}function hC(n,e){const t=ct(e);return t&&n.find(r=>{var i,o;return(i=r==null?void 0:r.lease)!=null&&i.isLeased?[r.id,r.name,(o=r.lease)==null?void 0:o.landlordName].filter(Boolean).map(ct).some(a=>a===t||a.includes(t)||t.includes(a)):!1})||null}function dC(n,e,t){const r=ct(t);if(!e||!r)return null;const s=n.filter(i=>i.buildingId===e&&ct(i.unitName)===r);return s.find(i=>i.status==="Active")||s[0]||null}function fC(n,e){const t=String(n.date||""),r=Math.round((Number(n.amount)||0)*100);return e.some(s=>s.deleted||s.status===gd.REJECTED?!1:Math.round((Number(s.amount)||0)*100)===r&&String(s.date||"")===t&&s.type===n.type&&(s.buildingId||"")===(n.buildingId||"")&&(s.unitNumber||"")===(n.unitNumber||"")&&ct(s.details||"")===ct(n.details||""))}function Ko(n="rentalIncome"){const e=An(n);return{headerRow:1,startRow:2,defaultPostType:e==="treasury"?"TREASURY":e==="expense"||e==="vatExpense"?"EXPENSE":e==="ownerExpense"?"OWNER_EXPENSE":e==="otherIncome"||e==="fees"?"OTHER_INCOME":"RENT",mapping:{date:"A",unit:e==="rentalIncome"||e==="vatIncome"||e==="fees"?"B":void 0,dueAmount:e==="rentalIncome"?"D":e==="vatIncome"?"E":e==="fees"?"D":void 0,category:e==="expense"||e==="otherIncome"||e==="vatExpense"?"B":void 0,subCategory:e==="expense"||e==="vatExpense"?"C":void 0,related:e==="expense"?"D":void 0,fromType:e==="treasury"?"B":void 0,fromAccount:e==="treasury"?"C":void 0,toType:e==="treasury"?"D":void 0,toAccount:e==="treasury"?"E":void 0,owner:e==="ownerExpense"?"B":void 0,customerVAT:e==="vatIncome"?"C":void 0,vendor:e==="vatExpense"?"D":void 0,vendorVAT:e==="vatExpense"?"E":void 0,vendorRefNo:e==="vatExpense"?"F":void 0,details:e==="rentalIncome"||e==="otherIncome"?"C":e==="expense"?"E":e==="ownerExpense"?"C":e==="vatIncome"?"D":e==="vatExpense"?"G":e==="treasury"?"K":"C",purpose:e==="treasury"?"J":void 0,notes:e==="treasury"?"K":void 0,paymentMethod:e==="rentalIncome"?"F":e==="otherIncome"?"D":e==="expense"?"F":e==="ownerExpense"?"D":e==="vatIncome"||e==="vatExpense"?"H":e==="treasury"?"F":"D",bank:e==="treasury"?"G":void 0,fromBank:e==="treasury"?"G":void 0,toBank:e==="treasury"?"H":void 0,amount:e==="rentalIncome"||e==="otherIncome"?"E":e==="expense"?"G":e==="ownerExpense"?"E":e==="vatIncome"?"F":e==="vatExpense"||e==="treasury"?"I":"E",extra:e==="expense"?"H":void 0,discount:e==="fees"?"H":void 0,...e==="rentalIncome"||e==="vatIncome"||e==="fees"?{date:"G"}:{}}}}function Id(n){const e=An(n);return e==="rentalIncome"?"Rental Income":e==="otherIncome"?"Other Income":e==="expense"?"Expenses":e==="ownerExpense"?"Owner Expenses":e==="vatIncome"?"VAT Sales":e==="vatExpense"?"VAT Purchase":e==="treasury"?"Treasury":"Fees"}function DI(n){const e=An(n);return e==="expense"?["Paid Date","Category","Target","Month","Details","Payment Method","Amount","Extra","Entered By","Status"]:e==="ownerExpense"?["Paid Date","Owner","Details","Payment Method","Amount","Entered By","Status"]:e==="otherIncome"?["Paid Date","Category","Details","Payment Method","Amount","Entered By","Status"]:e==="vatIncome"?["Due Date","Unit","Customer VAT","Details","Due Incl. VAT","Paid Incl. VAT","Paid Date","Payment Method","Entered By","Status"]:e==="vatExpense"?["Paid Date","Category","","Vendor","Vendor VAT","Invoice Number","Details","Payment Method","Amount Incl. VAT","Entered By","Status"]:e==="treasury"?["Paid Date","From Type","From Account","To Type","To Account","Payment Method","From Bank","To Bank","Amount","Purpose","Notes","Entered By","Status"]:e==="fees"?["Due Date","Unit","Details","Due","Paid","Payment Method","Paid Date","Discount","Entered By","Status"]:["Due Date","Unit","Details","Due Amount","Given Amount","Payment Method","Paid Date","Entered By","Status"]}function VI(n){const e=An(n);return e==="ownerExpense"?{date:"A",owner:"B",details:"C",paymentMethod:"D",amount:"E"}:Ko(e).mapping}function fn(n=Date.now(),e="rentalIncome",t){const r=An(e),s=DI(r),i=s.reduce((a,u,l)=>{const h=ms(l+1,1);return a[h]={address:h,raw:u,value:u,type:"text",style:{bold:!0,backgroundColor:"#f8fafc"}},a},{}),o=Ko(r);return{id:crypto.randomUUID(),name:Id(r),sheetKind:r,buildingId:t==null?void 0:t.id,buildingName:t==null?void 0:t.name,rowCount:15,colCount:s.length,cells:i,rowsMeta:{},postingConfig:{...o,mapping:VI(r)},createdAt:n,updatedAt:n}}function mC(n,e,t){const r=Date.now(),s=[fn(r,"rentalIncome",e),fn(r,"otherIncome",e),fn(r,"expense",e),fn(r,"ownerExpense",e),fn(r,"vatIncome",e),fn(r,"vatExpense",e),fn(r,"fees",e),fn(r,"treasury",e)],i=s[0];return{id:crypto.randomUUID(),name:t||`${e.name} Sheets`,buildingId:e.id,buildingName:e.name,sheets:s,activeSheetId:i.id,createdAt:r,updatedAt:r,createdBy:n.id,createdByName:n.name}}function pC(n,e){const t=Date.now(),r=new Map((n.sheets||[]).map(i=>[An(i.sheetKind||(i.name.toLowerCase().includes("owner")?"ownerExpense":i.name.toLowerCase().includes("other")?"otherIncome":i.name.toLowerCase().includes("sales")?"vatIncome":i.name.toLowerCase().includes("purchase")?"vatExpense":i.name.toLowerCase().includes("treasury")?"treasury":i.name.toLowerCase().includes("fee")?"fees":i.name.toLowerCase().includes("expense")?"expense":"income")),i])),s=["rentalIncome","otherIncome","expense","ownerExpense","vatIncome","vatExpense","fees","treasury"].map(i=>{const o=r.get(i);return o?{...o,name:Id(i),sheetKind:An(i),buildingId:e.id,buildingName:e.name,colCount:DI(i).length,postingConfig:{...Ko(i),...o.postingConfig||{},defaultPostType:Ko(i).defaultPostType,mapping:VI(i)},updatedAt:t}:fn(t,i,e)});return{...n,name:`${e.name} Sheets`,buildingId:e.id,buildingName:e.name,sheets:s,activeSheetId:n.activeSheetId&&s.some(i=>i.id===n.activeSheetId)?n.activeSheetId:s[0].id,updatedAt:t}}function OI(n){return n?!!(String(n.raw??"").trim()||n.formula||n.value!==void 0&&n.value!==null&&String(n.value).trim()||n.error||n.style&&Object.keys(n.style).length>0):!1}function gC(n){return String(n||"").replace(/\d+$/,"").toUpperCase()}function xI(n){return String(n||"").replace(/[A-Za-z][A-Za-z']*/g,e=>e.charAt(0).toUpperCase()+e.slice(1).toLowerCase())}function _C(n,e){var o;if(Number(((o=e.match(/\d+$/))==null?void 0:o[0])||0)<=1)return!1;const r=An(n.sheetKind),s=gC(e);return({rentalIncome:["B","C"],otherIncome:["B","C"],expense:["B","C","D","E"],ownerExpense:["B","C"],vatIncome:["B","D"],vatExpense:["B","C","D","G"],fees:["B","C"],treasury:["B","C","D","E","G","H","J","K"]}[r]||[]).includes(s)}function yC(n){return xI(n)}function IC(n){const e={...n.rowsMeta||{}},t=Object.values(n.cells||{}).reduce((r,s)=>{var l,h,f,p,_,w,b;const i=(l=s.posting)==null?void 0:l.postedTransactionId;if(i){const C=Number(((h=s.address.match(/\d+$/))==null?void 0:h[0])||0);if(C>1&&!((f=e[String(C)])!=null&&f.postedTransactionId)){const V=e[String(C)];e[String(C)]={row:C,status:"posted",enteredBy:(V==null?void 0:V.enteredBy)||((p=s.posting)==null?void 0:p.postedBy)||"",enteredByName:(V==null?void 0:V.enteredByName)||"",enteredAt:(V==null?void 0:V.enteredAt)||((_=s.posting)==null?void 0:_.postedAt)||Date.now(),updatedAt:(V==null?void 0:V.updatedAt)||Date.now(),...V,postedTransactionId:i,postedAt:(V==null?void 0:V.postedAt)||((w=s.posting)==null?void 0:w.postedAt)||Date.now(),postedBy:(V==null?void 0:V.postedBy)||((b=s.posting)==null?void 0:b.postedBy)}}}if(!OI(s))return r;const{posting:o,...a}=s,u=_C(n,s.address)&&!String(a.raw||"").trim().startsWith("=")?xI(a.raw):a.raw;return r[s.address]=u!==a.raw?{...a,raw:u,value:u,type:"text",formula:void 0,error:void 0}:a,r},{});return{...n,cells:t,rowsMeta:Object.entries(e).reduce((r,[s,i])=>(i&&(r[s]=i),r),{})}}function wC(n){return{...n,sheets:(n.sheets||[]).map(IC)}}function jV(n,e,t,r={}){var o;if(e<=1)return n;const s=(o=n.rowsMeta)==null?void 0:o[String(e)],i=Date.now();return{...n,rowsMeta:{...n.rowsMeta||{},[String(e)]:{row:e,status:(s==null?void 0:s.status)||"draft",enteredBy:(s==null?void 0:s.enteredBy)||t.id,enteredByName:(s==null?void 0:s.enteredByName)||t.name,enteredAt:(s==null?void 0:s.enteredAt)||i,updatedAt:i,...s,...r}},updatedAt:i}}function GV(n,e){var i,o,a,u,l,h,f,p,_,w,b,C,V;const t=n.postingConfig||Ko(),r=Math.min(t.endRow||n.rowCount,n.rowCount),s=[];for(let O=t.startRow;O<=r;O++){const L=Re(n,t.mapping.date,O),z=Ua(n,t.mapping.amount,O),ne=Ua(n,t.mapping.dueAmount,O),H=Re(n,t.mapping.details,O),T=Re(n,t.mapping.building,O),y=Re(n,t.mapping.unit,O),E=Re(n,t.mapping.category,O),v=Re(n,t.mapping.subCategory,O),A=Re(n,t.mapping.related,O),P=Re(n,t.mapping.customerVAT,O),I=Re(n,t.mapping.vendor,O),ot=Re(n,t.mapping.vendorVAT,O),Dt=Re(n,t.mapping.vendorRefNo,O),Ut=yp(Re(n,t.mapping.fromType,O)),Ni=Re(n,t.mapping.fromAccount,O),wt=yp(Re(n,t.mapping.toType,O)),Nn=Re(n,t.mapping.toAccount,O),gs=Re(n,t.mapping.purpose,O),Di=Re(n,t.mapping.notes,O),br=Re(n,t.mapping.employee||t.mapping.owner,O),_a=lC(Re(n,t.mapping.postType,O),t.defaultPostType),$t=ao(E,kt.SALARY),Sr=ao(E,kt.BORROWING),hn=ao(E,kt.PROPERTY_RENT),Vt=v,de=$t?"SALARY":Sr?"BORROWING":_a,se=An(n.sheetKind),Vi=(i=n.rowsMeta)==null?void 0:i[String(O)],_s=se==="rentalIncome"||se==="vatIncome"||se==="fees"?Re(n,"A",O):L;if(![L,z?String(z):"",H,T,y,E,v,br,I,Ut,Ni,wt,Nn,gs,Di].some(Boolean)||Vi!=null&&Vi.generatedDueSource&&z<=0&&!L)continue;const ys=((a=(o=n.rowsMeta)==null?void 0:o[String(O)])==null?void 0:a.postedTransactionId)||(((l=(u=n.rowsMeta)==null?void 0:u[String(O)])==null?void 0:l.status)==="posted"?`row-${O}`:"");if(ys){s.push({row:O,ok:!1,skipped:!0,errors:["Row already posted"],alreadyPostedTransactionId:ys});continue}const fe=[];if(L||fe.push("Date is required"),(!z||z<=0)&&fe.push("Amount must be positive"),se==="treasury"){const _u=Re(n,t.mapping.paymentMethod,O),Mi=Re(n,t.mapping.fromBank||t.mapping.bank,O),Li=Re(n,t.mapping.toBank,O),Bi=(ws,kr)=>{var Fi,On;return ws==="HEAD_OFFICE"?"HEAD_OFFICE":ws==="BUILDING"?((Fi=wp(e.buildings,kr||n.buildingId||n.buildingName||""))==null?void 0:Fi.id)||"":ws==="OWNER"&&((On=Ep(e.users,kr))==null?void 0:On.id)||""},jt=Bi(Ut,Ni),Vn=Bi(wt,Nn);Ut||fe.push("From Type is required"),wt||fe.push("To Type is required"),Ut&&!jt&&fe.push("From Account could not be matched"),wt&&!Vn&&fe.push("To Account could not be matched"),Ut&&wt&&Ut===wt&&jt&&Vn&&jt===Vn&&fe.push("Source and destination must be different"),gs||fe.push("Purpose is required");const Pr=Ip(_u);(Pr===tr.BANK||Pr===tr.CHEQUE)&&(!Mi||!Li)&&fe.push("From Bank and To Bank are required for bank/cheque treasury rows");const dn={id:crypto.randomUUID(),date:L,fromType:Ut,toType:wt,fromId:jt,toId:Vn,fromName:Ut==="HEAD_OFFICE"?"Head Office":Ni,toName:wt==="HEAD_OFFICE"?"Head Office":Nn,amount:z,purpose:gs||"Treasury Transfer",notes:Di||gs||"Treasury Transfer",paymentMethod:Pr,bankName:Mi||void 0,fromBankName:Mi||void 0,toBankName:Li||void 0,status:"COMPLETED",createdBy:((f=(h=n.rowsMeta)==null?void 0:h[String(O)])==null?void 0:f.enteredBy)||e.currentUser.id,createdByName:((_=(p=n.rowsMeta)==null?void 0:p[String(O)])==null?void 0:_.enteredByName)||e.currentUser.name,createdAt:Date.now()};s.push({row:O,ok:fe.length===0,errors:fe,transfer:fe.length?void 0:dn});continue}(se==="otherIncome"||se==="expense"||se==="vatExpense")&&!E&&fe.push("Category is required"),se==="expense"&&($t||Sr||hn||ao(E,kt.MAINTENANCE)||ao(E,kt.VENDOR_PAYMENT))&&!Vt&&fe.push("Target is required"),se==="expense"&&$t&&!A&&fe.push("Month is required for salary rows"),se==="vatIncome"&&!P&&fe.push("Customer VAT is required"),se==="vatExpense"&&!I&&fe.push("Vendor is required"),se==="vatExpense"&&!ot&&fe.push("Vendor VAT is required"),se==="vatExpense"&&!Dt&&fe.push("Invoice Number is required");const Pe=wp(e.buildings,T||n.buildingId||n.buildingName||"");["RENT","EXPENSE","OTHER_INCOME"].includes(de)&&!Pe&&fe.push("Building could not be matched");const Rr=Ip(Re(n,t.mapping.paymentMethod,O)),Oi=Re(n,t.mapping.bank,O);Rr===tr.BANK&&de!=="OWNER_EXPENSE"&&t.mapping.bank&&!Oi&&!(Pe!=null&&Pe.bankName)&&fe.push("Bank is required for bank rows");const Se=(de==="RENT"||se==="vatIncome"||se==="fees")&&Pe?dC(e.contracts,Pe.id,y):null;(de==="RENT"||se==="vatIncome"||se==="fees")&&!y&&fe.push("Unit is required");const he=Ep(e.users,Vt||br||H);(de==="SALARY"||de==="BORROWING")&&!he&&fe.push("Employee could not be matched"),de==="OWNER_EXPENSE"&&!he&&fe.push("Owner could not be matched");const ft=hn?hC(e.buildings,Vt):null;hn&&!ft&&fe.push("Leased property could not be matched");const pu=(Pe==null?void 0:Pe.propertyType)==="NON_RESIDENTIAL"||(Pe==null?void 0:Pe.vatApplicable)===!0,qt=se==="vatIncome"||se==="vatExpense"||se==="rentalIncome"&&pu,gu=z+(de==="EXPENSE"?Math.max(0,Ua(n,t.mapping.extra,O)):0),Dn=qt?Math.round(z/1.15*100)/100:void 0,ya=qt?Math.round((z-(Dn||0))*100)/100:void 0,xi=de==="RENT"||de==="OTHER_INCOME"||se==="vatIncome"||se==="fees"?$s.INCOME:$s.EXPENSE,Is={id:crypto.randomUUID(),date:L,type:xi,amount:qt?z:gu,vatAmount:ya,amountExcludingVAT:Dn,amountIncludingVAT:qt?z:void 0,totalWithVat:qt?z:void 0,vatRate:qt?15:void 0,isVATApplicable:qt,vatInvoiceNumber:se==="vatExpense"?Dt:void 0,paymentMethod:Rr,bankName:Rr===tr.BANK?Oi||(Pe==null?void 0:Pe.bankName):void 0,buildingId:(ft==null?void 0:ft.id)||(Pe==null?void 0:Pe.id),buildingName:(ft==null?void 0:ft.name)||(Pe==null?void 0:Pe.name),unitNumber:y||void 0,contractId:Se==null?void 0:Se.id,customerId:Se==null?void 0:Se.customerId,customerName:Se==null?void 0:Se.customerName,expectedAmount:de==="RENT"&&ne>0?ne:void 0,dueDate:(de==="RENT"||se==="fees")&&_s?_s:void 0,installmentStartDate:(de==="RENT"||se==="fees")&&_s?_s:void 0,incomeSubType:(de==="RENT"||se==="vatIncome")&&se!=="fees"?"RENTAL":de==="OTHER_INCOME"||se==="fees"?"OTHER":void 0,expenseCategory:de==="SALARY"?kt.SALARY:de==="BORROWING"?kt.BORROWING:de==="OWNER_EXPENSE"?kt.OWNER_EXPENSE:de==="EXPENSE"||se==="vatExpense"?E||kt.GENERAL:xi===$s.INCOME&&(de==="OTHER_INCOME"||se==="fees")?E||(se==="fees"?"Non-VAT Fees":"Other Income"):void 0,expenseSubCategory:$t||Sr||hn?void 0:v||void 0,employeeId:de==="SALARY"||de==="BORROWING"?he==null?void 0:he.id:void 0,employeeName:de==="SALARY"||de==="BORROWING"?(he==null?void 0:he.name)||Vt||br||A:void 0,ownerId:de==="OWNER_EXPENSE"?he==null?void 0:he.id:void 0,ownerName:de==="OWNER_EXPENSE"?(he==null?void 0:he.name)||br:void 0,borrowingType:de==="BORROWING"?"BORROW":void 0,salaryPeriod:de==="SALARY"?A:void 0,vendorName:se==="vatExpense"?I:(E===kt.MAINTENANCE||E===kt.VENDOR_PAYMENT)&&Vt||void 0,vendorVATNumber:se==="vatExpense"?ot:void 0,vendorRefNo:se==="vatExpense"?Dt:void 0,customerVATNumber:se==="vatIncome"?P:void 0,feesEntry:se==="fees"?!0:void 0,discountAmount:se==="fees"&&Math.max(0,Ua(n,t.mapping.discount,O))||void 0,details:H||($t?`Salary ${A||""} - ${(he==null?void 0:he.name)||Vt}`.trim():hn?`Property Rent - ${(ft==null?void 0:ft.name)||Vt}`:`${Id(se)}${y?` - Unit ${y}`:""}`),source:"amlak_sheets",sourceLabel:"Amlak Sheets",postedFromAmlakSheets:!0,status:gd.APPROVED,createdAt:Date.now(),createdBy:((b=(w=n.rowsMeta)==null?void 0:w[String(O)])==null?void 0:b.enteredBy)||e.currentUser.id,createdByName:((V=(C=n.rowsMeta)==null?void 0:C[String(O)])==null?void 0:V.enteredByName)||e.currentUser.name};fC(Is,e.existingTransactions)&&fe.push("Possible duplicate transaction already exists"),s.push({row:O,ok:fe.length===0,errors:fe,transaction:fe.length?void 0:Is})}return s}function zV(n,e){const t=Object.values(n.cells||{}).reduce((s,i)=>{if(!OI(i))return s;const{posting:o,...a}=i;return s[i.address]=a,s},{}),r={...n.rowsMeta||{}};return e.forEach(s=>{const i=r[String(s.row)];r[String(s.row)]={row:s.row,status:"posted",enteredBy:(i==null?void 0:i.enteredBy)||s.postedBy,enteredByName:(i==null?void 0:i.enteredByName)||"",enteredAt:(i==null?void 0:i.enteredAt)||Date.now(),updatedAt:Date.now(),...i,postedTransactionId:s.transactionId,postedAt:Date.now(),postedBy:s.postedBy}}),{...n,cells:t,rowsMeta:r,updatedAt:Date.now()}}const Ju="Inter-Building Transfer";function MI(n){return n.source==="treasury"||n.paymentMethod==="TREASURY"||n.paymentMethod==="TREASURY_REVERSAL"}function rc(n){return MI(n)&&String(n.fromType||"").toUpperCase()==="BUILDING"&&String(n.toType||"").toUpperCase()==="BUILDING"&&!!n.fromId&&!!n.toId&&String(n.fromId)!==String(n.toId)}function EC(n){const e=String(n.originalPaymentMethod||n.paymentMethod||"").toUpperCase();return["CASH","BANK","CHEQUE"].includes(e)?e:"BANK"}function TC(n,e){if(rc(n)){const t=String(n.interBuildingRole||"").toUpperCase(),r=String(n.type||"").toUpperCase();if(t==="DEST"||r===$s.INCOME)return["otherIncome"];if(t==="SOURCE"||r===$s.EXPENSE)return["expense"]}if(MI(n))return["treasury"];if(n.type==="INCOME"){const t=e.propertyType==="NON_RESIDENTIAL"||e.vatApplicable===!0;return n.feesEntry?["fees"]:t&&(n.isVATApplicable||n.incomeSubType!=="OTHER")?["rentalIncome","vatIncome"]:n.incomeSubType==="OTHER"?["otherIncome"]:["rentalIncome"]}return n.type==="EXPENSE"?n.isVATApplicable?["vatExpense"]:n.expenseCategory==="Owner Expense"||n.expenseCategory==="Owner Profit Withdrawal"?["ownerExpense"]:["expense"]:[]}const Tp=new Set(["+","-","*","/","^","&","=","<>","<",">","<=",">="]);function AC(n){const e=n.trim().replace(/^=/,""),t=[];let r=0;for(;r<e.length;){const s=e[r];if(/\s/.test(s)){r++;continue}if(s==='"'||s==="'"){const o=s;let a="";for(r++;r<e.length&&e[r]!==o;)a+=e[r++];if(e[r]!==o)throw new Error("Unclosed string");r++,t.push({type:"string",value:a});continue}if(/\d|\./.test(s)){let o="";for(;r<e.length&&/[\d.]/.test(e[r]);)o+=e[r++];if(!/^\d+(\.\d+)?$|^\.\d+$/.test(o))throw new Error(`Invalid number: ${o}`);t.push({type:"number",value:o});continue}if(/[A-Za-z_$]/.test(s)){let o="";for(;r<e.length&&/[A-Za-z0-9_.$]/.test(e[r]);)o+=e[r++];t.push({type:"identifier",value:o});continue}const i=e.slice(r,r+2);if(Tp.has(i)){t.push({type:"operator",value:i}),r+=2;continue}if(Tp.has(s)){t.push({type:"operator",value:s}),r++;continue}if(s==="("||s===")"){t.push({type:"paren",value:s}),r++;continue}if(s===","){t.push({type:"comma",value:s}),r++;continue}if(s===":"){t.push({type:"colon",value:s}),r++;continue}throw new Error(`Unexpected token: ${s}`)}return t.push({type:"eof",value:""}),t}function LI(n){return Array.isArray(n)?n.flatMap(LI):[n]}function Le(n){if(Array.isArray(n))return Le(n[0]??0);if(typeof n=="number")return Number.isFinite(n)?n:0;if(typeof n=="boolean")return n?1:0;if(n==null||n==="")return 0;const e=Number(String(n).replace(/,/g,""));return Number.isFinite(e)?e:0}function Wo(n){return Array.isArray(n)?Wo(n[0]??""):n==null?"":String(n)}function BI(n){return Array.isArray(n)?n.some(BI):typeof n=="boolean"?n:typeof n=="number"?n!==0:!!String(n||"").trim()}function vC(n,e,t){const r=Wo(n),s=Wo(t),i=Number(r),o=Number(s),a=Number.isFinite(i)&&Number.isFinite(o),u=a?i:r.toLowerCase(),l=a?o:s.toLowerCase();return e==="="?u===l:e==="<>"?u!==l:e==="<"?u<l:e===">"?u>l:e==="<="?u<=l:e===">="?u>=l:!1}class bC{constructor(e,t){this.tokens=e,this.context=t,this.index=0}parse(){const e=this.parseComparison();if(this.peek().type!=="eof")throw new Error(`Unexpected token: ${this.peek().value}`);return e}peek(e=0){return this.tokens[this.index+e]||{type:"eof",value:""}}take(){return this.tokens[this.index++]||{type:"eof",value:""}}match(e,t){const r=this.peek();return r.type!==e||t!=null&&r.value!==t?!1:(this.index++,!0)}parseComparison(){let e=this.parseConcat();for(;this.peek().type==="operator"&&["=","<>","<",">","<=",">="].includes(this.peek().value);){const t=this.take().value,r=this.parseConcat();e=vC(e,t,r)}return e}parseConcat(){let e=this.parseAdditive();for(;this.peek().type==="operator"&&this.peek().value==="&";)this.take(),e=Wo(e)+Wo(this.parseAdditive());return e}parseAdditive(){let e=this.parseMultiplicative();for(;this.peek().type==="operator"&&["+","-"].includes(this.peek().value);){const t=this.take().value,r=this.parseMultiplicative();e=t==="+"?Le(e)+Le(r):Le(e)-Le(r)}return e}parseMultiplicative(){let e=this.parsePower();for(;this.peek().type==="operator"&&["*","/"].includes(this.peek().value);){const t=this.take().value,r=this.parsePower(),s=Le(r);e=t==="*"?Le(e)*s:s===0?"#DIV/0!":Le(e)/s}return e}parsePower(){let e=this.parseUnary();for(;this.peek().type==="operator"&&this.peek().value==="^";)this.take(),e=Math.pow(Le(e),Le(this.parseUnary()));return e}parseUnary(){return this.peek().type==="operator"&&this.peek().value==="-"?(this.take(),-Le(this.parseUnary())):this.peek().type==="operator"&&this.peek().value==="+"?(this.take(),Le(this.parseUnary())):this.parsePrimary()}parsePrimary(){const e=this.take();if(e.type==="number")return Number(e.value);if(e.type==="string")return e.value;if(e.type==="paren"&&e.value==="("){const t=this.parseComparison();if(!this.match("paren",")"))throw new Error("Missing closing parenthesis");return t}if(e.type==="identifier"){const t=e.value.toUpperCase();if(this.match("paren","(")){const r=[];if(!this.match("paren",")")){do r.push(this.parseComparison());while(this.match("comma"));if(!this.match("paren",")"))throw new Error(`Missing ) for ${t}`)}return PC(t,r)}if(_p(e.value)){if(this.match("colon")){const r=this.take();if(r.type!=="identifier"||!_p(r.value))throw new Error("Invalid range");return uC(`${e.value}:${r.value}`).map(s=>this.context.getCellValue(s))}return this.context.getCellValue(yd(e.value))}if(t==="TRUE")return!0;if(t==="FALSE")return!1;throw new Error(`Unknown name: ${e.value}`)}throw new Error(`Unexpected token: ${e.value||e.type}`)}}function SC(){return new Date().toISOString().slice(0,10)}function RC(n,e,t){const r=new Date(Date.UTC(n,e-1,t));return Number.isNaN(r.getTime())?"#VALUE!":r.toISOString().slice(0,10)}function PC(n,e){const t=e.flatMap(LI);switch(n){case"SUM":return t.reduce((r,s)=>r+Le(s),0);case"AVERAGE":{const r=t.map(Le);return r.length?r.reduce((s,i)=>s+i,0)/r.length:0}case"MIN":return Math.min(...t.map(Le));case"MAX":return Math.max(...t.map(Le));case"COUNT":return t.filter(r=>r!==null&&r!==""&&Number.isFinite(Number(r))).length;case"COUNTA":return t.filter(r=>r!==null&&r!=="").length;case"IF":return BI(e[0])?e[1]??!0:e[2]??!1;case"ROUND":return Number(Le(e[0]).toFixed(Math.max(0,Math.floor(Le(e[1])))));case"ABS":return Math.abs(Le(e[0]));case"TODAY":return SC();case"DATE":return RC(Le(e[0]),Le(e[1]),Le(e[2]));default:throw new Error(`Unsupported formula: ${n}`)}}function kC(n,e){return String(n||"").trim()?new bC(AC(n),e).parse():null}function FI(n){return Array.isArray(n)?n.map(e=>FI(e)).join(","):n}function UI(n){const e=String(n??"");if(!e.trim())return{value:null,type:"empty"};if(e.trim().startsWith("="))return{formula:e.trim(),value:null,type:"formula"};if(/^(true|false)$/i.test(e.trim()))return{value:/^true$/i.test(e.trim()),type:"boolean"};const t=Number(e.replace(/,/g,""));return Number.isFinite(t)&&e.trim()!==""?{value:t,type:"number"}:/^\d{4}-\d{2}-\d{2}$/.test(e.trim())?{value:e.trim(),type:"date"}:{value:e,type:"text"}}function Q(n,e,t){const r=yd(e),s={...n.cells};return String(t??"").trim()?s[r]={...s[r]||{address:r},address:r,raw:t,...UI(t)}:delete s[r],CC({...n,cells:s,updatedAt:Date.now()})}function CC(n){const e=n.cells||{},t={},r=new Set,s=new Set,i=o=>{var f;const a=yd(o),u=e[a];if(!u)return null;if(s.has(a))return((f=t[a])==null?void 0:f.value)??null;if(r.has(a))return t[a]={...u,address:a,value:"#CYCLE!",type:"error",error:"Circular reference"},s.add(a),"#CYCLE!";r.add(a);const l=UI(u.raw);let h={...u,address:a,...l};if(l.formula)try{const p=kC(l.formula,{getCellValue:i}),_=FI(p);_==="#CYCLE!"?h={...h,value:_,type:"error",error:"Circular reference"}:h={...h,value:_,type:typeof _=="number"?"number":"formula",error:void 0}}catch(p){h={...h,value:"#ERROR!",type:"error",error:(p==null?void 0:p.message)||"Formula error"}}return r.delete(a),s.add(a),t[a]=h,h.value??null};return Object.keys(e).forEach(i),{...n,cells:t,updatedAt:Date.now()}}const $I=5,Ho=n=>n==="income"?"rentalIncome":n||"rentalIncome",Ge=n=>String(n||"").trim().toLowerCase().replace(/\s+/g," "),Ap=n=>String(Math.round((Number(n)||0)*100)),Pc=n=>{const e=String(n||"").trim();if(!e)return[];const t=e.split(":").map(r=>r.trim()).filter(Boolean);return Array.from(new Set([e,t[t.length-1]||e]))},Je=(n,e,t)=>{var i;const r=ms(_d(e),t),s=(i=n.cells)==null?void 0:i[r];return String((s==null?void 0:s.raw)??(s==null?void 0:s.value)??"").trim()},qI=(n,e)=>{var t,r;for(let s=1;s<=n.colCount;s++){const i=(r=(t=n.cells)==null?void 0:t[ms(s,e)])==null?void 0:r.raw;if(String(i??"").trim())return!0}return!1},vp=(n,e)=>Array.from({length:n.colCount},(t,r)=>{var s,i;return((i=(s=n.cells)==null?void 0:s[ms(r+1,e)])==null?void 0:i.raw)||""}).join(""),jI=n=>Math.max(1,...Object.keys(n.rowsMeta||{}).map(Number).filter(e=>Number.isFinite(e)&&e>1),...Object.values(n.cells||{}).map(e=>{var t;return Number(((t=e.address.match(/\d+$/))==null?void 0:t[0])||0)}).filter(e=>e>1)),NC=n=>{for(let e=2;e<=n.rowCount;e++)if(!qI(n,e))return e;return n.rowCount+1},DC=(n,e)=>{const t=Math.max(e,jI(n)+$I);return t<=n.rowCount?n:{...n,rowCount:t,updatedAt:Date.now()}},bp=n=>{const e=Math.max(n.rowCount||1,jI(n)+$I);return e===n.rowCount?n:{...n,rowCount:e,updatedAt:Date.now()}},VC=n=>Number(n.amountIncludingVAT??n.totalWithVat??n.amount)||0;function OC(n,e,t){const r=Ho(e),s=r==="rentalIncome"||r==="otherIncome"?"E":r==="expense"?"G":r==="ownerExpense"?"E":r==="vatIncome"?"F":r==="vatExpense"?"I":r==="fees"?"E":"I",i=r==="expense"?"H":"",o=Number(String(Je(n,s,t)||"").replace(/,/g,""))||0,a=i&&Number(String(Je(n,i,t)||"").replace(/,/g,""))||0;return Math.max(0,o+a)}function xC(n,e,t,r){const s=Ho(t);if(s==="rentalIncome"||s==="vatIncome"||s==="fees"){const a=Je(n,"G",r),u=Je(n,"A",r),l=String(e.dueDate||e.installmentStartDate||e.date||"");if(a?a!==e.date:u!==l&&u!==e.date)return!1}else if(Je(n,"A",r)!==e.date)return!1;const i=s==="expense"?(Number(e.amount)||0)+(Number(e.extraAmount)||0):VC(e),o=s==="rentalIncome"?Number(String(Je(n,"E",r)||Je(n,"D",r)||"").replace(/,/g,""))||0:OC(n,t,r);return o>0&&i>0&&Ap(o)!==Ap(i)?!1:s==="rentalIncome"||s==="vatIncome"||s==="fees"?Ge(Je(n,"B",r))===Ge(e.unitNumber):s==="otherIncome"?Ge(Je(n,"B",r))===Ge(e.expenseCategory||"Other Income"):s==="ownerExpense"?Ge(Je(n,"B",r))===Ge(e.ownerName):s==="vatExpense"?Ge(Je(n,"D",r)||Je(n,"F",r))===Ge(e.vendorName||e.vendorRefNo||e.vatInvoiceNumber):s==="treasury"?Ge(Je(n,"B",r))===Ge(e.fromType)&&Ge(Je(n,"C",r))===Ge(e.fromId)&&Ge(Je(n,"D",r))===Ge(e.toType)&&Ge(Je(n,"E",r))===Ge(e.toId):Ge(Je(n,"B",r))===Ge(e.expenseCategory||"General Expense")}function MC(n,e,t){var r;for(let s=2;s<=n.rowCount;s++){const i=(r=n.rowsMeta)==null?void 0:r[String(s)];if((i==null?void 0:i.postedTransactionId)===e.id)return s;if((i==null?void 0:i.status)!=="posted"&&qI(n,s)&&xC(n,e,t,s))return s}return 0}function LC(n,e){if(!e.id)return 0;const t=Object.entries(n.rowsMeta||{}).find(([,r])=>(r==null?void 0:r.postedTransactionId)===e.id);return Number((t==null?void 0:t[0])||0)}function BC(n,e,t){return{...n,rowsMeta:{...n.rowsMeta||{},[String(e)]:{row:e,status:"posted",enteredBy:t.createdBy||"system",enteredByName:t.createdByName||"Amlak",enteredAt:t.createdAt||Date.now(),updatedAt:Date.now(),postedTransactionId:t.id,postedAt:t.createdAt||Date.now(),postedBy:t.createdBy||"system",postedByName:t.createdByName||"Amlak"}},updatedAt:Date.now()}}function GI(n,e){if(!n||!e)return!1;const t=new Set(Pc(e.id));if([n.buildingId,n.building,n.building_id,n.id].flatMap(Pc).some(o=>t.has(o)))return!0;const s=Ge(e.name||e.buildingName||""),i=Ge(n.buildingName||n.building_name||"");return!!s&&!!i&&s===i}function FC(n){const e=n,t=String(n.name||e._rawBuildingId||n.id||"").trim(),r=String(e._bookDisplayName||e.bookName||"").trim();return r?`${t} - ${r}`:t}function zI(n,e){const t=new Set(Pc(n));if(!t.size)return"";const r=e.find(s=>[s.id,s._rawBuildingId,s.rawId,s.buildingId].flatMap(Pc).some(o=>t.has(o)));return r?FC(r):""}function Sp(n,e,t){const r=n,s=e==="from"?r.fromId:r.toId,i=e==="from"?r.fromName:r.toName;return zI(s,t)||String(i||s||"").trim()}function UC(n,e,t,r){var w;const i=LC(n,e)||MC(n,e,t)||NC(n);let o=DC(n,i);const a=String(e.amountIncludingVAT||e.totalWithVat||e.amount||""),u=b=>yC(b||""),l=EC(e),h=u(e.details||e.purpose||""),f=zI(e.buildingId,r)||e.buildingName||"",p=Ho(t);p==="rentalIncome"?(o=Q(o,`A${i}`,String(e.dueDate||e.installmentStartDate||e.date||Je(n,"A",i)||"")),o=Q(o,`B${i}`,e.unitNumber||""),o=Q(o,`C${i}`,u(e.details)),o=Q(o,`D${i}`,String(e.expectedAmount||Je(n,"D",i)||e.amountIncludingVAT||e.totalWithVat||e.amount||"")),o=Q(o,`E${i}`,a),o=Q(o,`F${i}`,l),o=Q(o,`G${i}`,e.date||"")):p==="otherIncome"?(o=Q(o,`A${i}`,e.date||""),o=Q(o,`B${i}`,u(e.expenseCategory||(rc(e)?Ju:"Other Income"))),o=Q(o,`C${i}`,h||(rc(e)?u(Ju):"")),o=Q(o,`D${i}`,l),o=Q(o,`E${i}`,a)):p==="expense"?(o=Q(o,`A${i}`,e.date||""),o=Q(o,`B${i}`,u(e.expenseCategory||(rc(e)?Ju:"General Expense"))),o=Q(o,`C${i}`,u(e.employeeName||e.vendorName||f||e.expenseSubCategory||"")),o=Q(o,`D${i}`,u(e.salaryPeriod||"")),o=Q(o,`E${i}`,h),o=Q(o,`F${i}`,l),o=Q(o,`G${i}`,String(e.amount||"")),o=Q(o,`H${i}`,String(e.extraAmount||""))):p==="ownerExpense"?(o=Q(o,`A${i}`,e.date||""),o=Q(o,`B${i}`,u(e.ownerName)),o=Q(o,`C${i}`,h),o=Q(o,`D${i}`,l),o=Q(o,`E${i}`,String(e.amount||""))):p==="vatIncome"?(o=Q(o,`A${i}`,String(e.dueDate||e.installmentStartDate||e.date||"")),o=Q(o,`B${i}`,e.unitNumber||""),o=Q(o,`C${i}`,e.customerVATNumber||""),o=Q(o,`D${i}`,h),o=Q(o,`E${i}`,String(e.expectedAmount||e.amountIncludingVAT||e.totalWithVat||e.amount||"")),o=Q(o,`F${i}`,a),o=Q(o,`G${i}`,e.date||""),o=Q(o,`H${i}`,l)):p==="vatExpense"?(o=Q(o,`A${i}`,e.date||""),o=Q(o,`B${i}`,u(e.expenseCategory||"Vendor Payment")),o=Q(o,`C${i}`,u(e.expenseSubCategory)),o=Q(o,`D${i}`,u(e.vendorName)),o=Q(o,`E${i}`,e.vendorVATNumber||""),o=Q(o,`F${i}`,e.vendorRefNo||e.vatInvoiceNumber||""),o=Q(o,`G${i}`,h),o=Q(o,`H${i}`,l),o=Q(o,`I${i}`,a)):p==="fees"?(o=Q(o,`A${i}`,String(e.dueDate||e.installmentStartDate||e.date||"")),o=Q(o,`B${i}`,e.unitNumber||""),o=Q(o,`C${i}`,h),o=Q(o,`D${i}`,String(e.expectedAmount||e.amount||"")),o=Q(o,`E${i}`,String(e.amount||"")),o=Q(o,`F${i}`,l),o=Q(o,`G${i}`,e.date||""),o=Q(o,`H${i}`,String(e.discountAmount||""))):p==="treasury"&&(o=Q(o,`A${i}`,e.date||""),o=Q(o,`B${i}`,u(e.fromType)),o=Q(o,`C${i}`,u(Sp(e,"from",r))),o=Q(o,`D${i}`,u(e.toType)),o=Q(o,`E${i}`,u(Sp(e,"to",r))),o=Q(o,`F${i}`,u(e.originalPaymentMethod||e.paymentMethod||"CASH")),o=Q(o,`G${i}`,u(e.fromBankName||e.bankName)),o=Q(o,`H${i}`,u(e.toBankName)),o=Q(o,`I${i}`,String(e.amount||"")),o=Q(o,`J${i}`,u(e.purpose||"Treasury Transfer")),o=Q(o,`K${i}`,u(e.details)));const _=(w=n.rowsMeta)==null?void 0:w[String(i)];return vp(o,i)===vp(n,i)&&(_==null?void 0:_.status)==="posted"&&(_==null?void 0:_.postedTransactionId)===e.id?n:BC(o,i,e)}function $C(n,e){return e.find(t=>GI(n,t))||null}function qC(n,e,t){if(!(e!=null&&e.id)||e.deleted||e.status==="REJECTED"||e.vatReportOnly)return{workbooks:n,changed:!1,syncedWorkbookIds:[]};const r=$C(e,t);if(!r)return{workbooks:n,changed:!1,syncedWorkbookIds:[]};const s=TC(e,r);if(!s.length)return{workbooks:n,changed:!1,syncedWorkbookIds:[]};const i={id:e.createdBy||"system",name:e.createdByName||"Amlak",role:CI.ADMIN},o=n.findIndex(p=>!p.deleted&&GI(p,r)),a=o>=0?n[o]:mC(i,r);let u=pC(a,r),l=o<0||u!==a;const h=u.sheets.map(p=>bp({...p}));return s.forEach(p=>{const _=h.findIndex(C=>Ho(C.sheetKind)===Ho(p));if(_<0)return;const w=h[_],b=UC(w,e,p,t);b!==w&&(h[_]=b,l=!0)}),l?(u={...u,sheets:h.map(bp),updatedAt:Date.now()},{workbooks:o>=0?n.map((p,_)=>_===o?u:p):[...n,u],changed:!0,syncedWorkbookIds:[u.id]}):{workbooks:n,changed:!1,syncedWorkbookIds:[]}}const KI=["bankName","fromBankName","toBankName"];function xt(n){return String(n||"").trim().replace(/\s+/g," ").toLowerCase()}function jC(n){return new Set(n.map(xt).filter(Boolean))}function GC(n,e=KI){const t={};return n.forEach(r=>{const s=new Set;e.forEach(i=>{const o=xt(r==null?void 0:r[i]);o&&s.add(o)}),s.forEach(i=>{t[i]=(t[i]||0)+1})}),t}function zC(n,e,t,r={}){const s=jC(e),i=String(t||"").trim();if(!s.size||!i)return null;const o={};return(r.fields||KI).forEach(u=>{s.has(xt(n==null?void 0:n[u]))&&(o[u]=i)}),r.includeVatReportSnapshot&&(n!=null&&n.vatReportSnapshot)&&s.has(xt(n.vatReportSnapshot.bankName))&&(o.vatReportSnapshot={...n.vatReportSnapshot,bankName:i}),Object.keys(o).length>0?o:null}const qs=new Map,KC=9e4;function WI(n,e=KC){const t=qs.get(n);return t?Date.now()-t.at>e?(qs.delete(n),null):t.data:null}function HI(n,e){qs.set(n,{data:e,at:Date.now()})}function fa(n){if(!n){qs.clear();return}for(const e of qs.keys())e.startsWith(n)&&qs.delete(e)}function on(n,e){fa(`col:${e||"default"}:${n}:`)}const Yu={},QI=(Yu==null?void 0:Yu.VITE_MAC_API_URL)||"http://mac-mini.local:8787";function WC(){return typeof window>"u"?!0:["localhost","127.0.0.1","::1","[::1]"].includes(window.location.hostname)}function HC(){const n=String(QI).trim();if(typeof window<"u"){const e=window.location.origin;if(!WC()){if(!n||n==="/"||n==="./"||n==="same-origin")return e;try{if(new URL(n,e).origin!==e)return e}catch{return e}}}return!n||n==="/"||n==="./"||n==="same-origin"?typeof window<"u"?window.location.origin:"":n.replace(/\/+$/,"")}function KV(){return String(QI).trim()}let di="unknown",Ml=0,JI=0;const QC=new Set,JC=6e4;function YI(){QC.forEach(n=>n(di))}function YC(){Ml=0,di!=="healthy"&&(di="healthy",YI())}function XC(n){Ml+=1,JI=Date.now(),(n===502||n===503||n===504||n===0||Ml>=3)&&di!=="unhealthy"&&(di="unhealthy",YI())}function ZC(){return di!=="unhealthy"?!0:Date.now()-JI>=JC}const Xu={},Rp=(Xu==null?void 0:Xu.VITE_MAC_API_TOKEN)||"";function eN(){return HC()}function tN(){const n={"Content-Type":"application/json"};return Rp&&(n.Authorization=`Bearer ${Rp}`),n}async function XI(n,e){if(!ZC())throw new Error("Mac API temporarily unavailable");const t=await fetch(`${eN()}${n}`,{...e,headers:{...tN(),...(e==null?void 0:e.headers)||{}}});if(!t.ok){XC(t.status);const r=await t.text().catch(()=>"");throw new Error(`Mac API ${t.status}: ${r||t.statusText}`)}return YC(),t.json()}function nN(n,e){const t=new URLSearchParams;t.set("bookId",(e==null?void 0:e.bookId)||"default"),e!=null&&e.orderField&&t.set("orderField",e.orderField),e!=null&&e.orderDirection&&t.set("orderDirection",e.orderDirection),e!=null&&e.includeDeleted&&t.set("includeDeleted","true");for(const[r,s]of Object.entries((e==null?void 0:e.filters)||{}))s==null||s===""||t.set(`filter.${r}`,String(s));return`/api/collections/${encodeURIComponent(n)}?${t.toString()}`}async function WV(n,e){return(await XI(nN(n,e))).items||[]}async function HV(n,e,t){const r=e!=null&&e.id?String(e.id):"",s=(t==null?void 0:t.bookId)||"default",i=new URLSearchParams({bookId:s});t!=null&&t.merge&&i.set("merge","true");const o=r?`/api/collections/${encodeURIComponent(n)}/${encodeURIComponent(r)}?${i.toString()}`:`/api/collections/${encodeURIComponent(n)}?${i.toString()}`;return(await XI(o,{method:r?"PUT":"POST",body:JSON.stringify({data:e})})).item}const Ll=new Set,Bl=new Set;function ZI(n,e){return`${n}|${e}`}function rN(n){Ll.clear();for(const e of n||[])(e.status||"PENDING")==="PENDING"&&(!e.type||!e.targetId||Ll.add(ZI(e.type,e.targetId)));Bl.forEach(e=>e())}function QV(n,e){return Ll.has(ZI(n,e))}function JV(n){return Bl.add(n),()=>Bl.delete(n)}function q(){return Qh(is)}const ps=async n=>{const t=new TextEncoder().encode(n),r=await crypto.subtle.digest("SHA-256",t);return Array.from(new Uint8Array(r)).map(i=>i.toString(16).padStart(2,"0")).join("")},kc=async(n,e)=>/^[0-9a-f]{64}$/.test(e)?await ps(n)===e:n===e;function Fl(n){if(!n)return!1;const e=String(n.role??"").toUpperCase();return!!(n.isOwner||e==="OWNER")}const Ul="OWNER_PORTAL_ONLY_LOGIN",Be=n=>n.docs.map(e=>({...e.data()||{},id:e.id})),$=n=>{if(n==null)return n;if(Array.isArray(n))return n.map($);if(typeof n!="object")return n;const e={};return Object.entries(n).forEach(([t,r])=>{r!==void 0&&(e[t]=$(r))}),e},It=(n,e)=>{(typeof n=="function"?n():n).catch(r=>console.warn(`${e} failed`,r))};let He="default";const Ri=new Set(["transactions","buildings","contracts","customers","vendors","tasks","stocks","stock","stock_entries","transfers","service_agreements","approvals","users","notifications","images","registry","stockItems","stockTransfers","sadad_bills","ejar_contracts","utility_readings","security_deposits","whatsapp_messages","bank_statements","reconciliation_records","nafath_verifications","municipality_licenses","civil_defense_records","absher_records","amlakSheets"]),sN=new Set(["transactions","buildings","contracts","customers","vendors","users","banks","meta","books","tasks","approvals","transfers","audit","amlakSheets","stocks","stock","stock_entries","stockItems","stockTransfers","registry","service_agreements","borrowings","sadad_bills","ejar_contracts","utility_readings","security_deposits","municipality_licenses","civil_defense_records","absher_records","whatsapp_messages","bank_statements","reconciliation_records","nafath_verifications","notifications","chatRooms","chatMessages","chatPresence","chatStatuses","userTokens","voiceCallSessions","callSignals","callHistory","callPresence","images","backups"]),iN=Array.from(new Set([...Array.from(Ri),...Array.from(sN)])),vr=n=>!1;typeof window<"u"&&console.info("[Amlak] Data backend: Firebase Firestore (saudi-property-manager)");const ew=n=>He==="default"||!Ri.has(n)?n:`book_${He}_${n}`,W=(n,...e)=>{const t=q(),r=ew(n);return e.length>0?te(t,r,...e):te(t,r)},M=(n,...e)=>{const t=q(),r=ew(n);return We(t,r,...e)},oN=n=>{const e=n||"default";e!==He&&fa("col:"),He=e},Cn=()=>He,ln=(n,e)=>!n||n==="default"||!Ri.has(e)?e:`book_${n}_${e}`,js=(n,e)=>te(q(),ln(n,e)),pe=(n,e,t)=>t?We(q(),ln(n,e),t):We(js(n,e)),aN=async(n,e)=>{const t=$(e),r=ln(n||"default","transactions");return e!=null&&e.id?G(We(q(),r,e.id),t):X(te(q(),r),t)},os=(n,e)=>{if(!n)return{bookId:e,rawId:n};if(typeof n=="string"&&n.includes(":")){const t=n.indexOf(":"),r=n.slice(0,t),s=n.slice(t+1);return{bookId:r||e,rawId:s||n}}return{bookId:e,rawId:n}},cN=(n,e,t)=>{const r=os(n,t),s=os(e,t);return r.bookId===s.bookId&&r.rawId===s.rawId};let So=[],wd=null;const uN=n=>n&&n!=="ADMIN"&&n!=="MANAGER",lN=(n,e)=>!n||typeof n!="object"?!1:n.buildingId===e||n.building===e||n.building_id===e||n.id===e,$l=(n,e)=>!e||e.length===0?!1:e.some(t=>lN(n,t)),tw=(n,e)=>uN(wd)?So.length===0?["buildings","contracts","transactions","stocks","stockItems","stockTransfers","units","tasks"].includes(n)?[]:e:n==="buildings"?e.filter(r=>$l(r,So)):["contracts","transactions","stocks","stockItems","stockTransfers","units","tasks"].includes(n)?e.filter(r=>$l(r,So)):e:e,hN=n=>{So=n!=null&&n.buildingIds&&n.buildingIds.length>0?n.buildingIds:n!=null&&n.buildingId?[n.buildingId]:[],wd=(n==null?void 0:n.role)||null},we=async(n,e,t)=>{const r=typeof e=="string"?e:(e==null?void 0:e.orderField)||(t==null?void 0:t.orderField),s=typeof e=="string"?(t==null?void 0:t.includeDeleted)??!1:(e==null?void 0:e.includeDeleted)??!1,i=`col:${He}:${n}:${r||""}:${s}`,o=WI(i);if(o)return o;const a=W(n),u=r?Ae(a,ha(r,"desc")):a,l=await Y(u),h=Be(l),f=tw(n,h),p=s?f:f.filter(_=>!_.deleted);return HI(i,p),p},nw=async n=>we("vendors",{includeDeleted:!!(n!=null&&n.includeDeleted)}),dN=async n=>{const e=$(n);return n.id?G(M("vendors",n.id),e):X(W("vendors"),e)},fN=async n=>me(M("vendors",n)),rw=async(n,e)=>{if(n){const t=Ae(W("tasks"),Ne("userId","==",n)),r=await Y(t),s=Be(r);return e!=null&&e.includeDeleted?s:s.filter(i=>!i.deleted)}return we("tasks",{includeDeleted:!!(e!=null&&e.includeDeleted)})},mN=async n=>{const e=$(n);return n.id?G(M("tasks",n.id),e):X(W("tasks"),e)},pN=async n=>me(M("tasks",n)),sw=async()=>{const n=await Y(W("meta")),e=Be(n);return e.find(r=>r.id==="settings")||e[0]||null},gN=async n=>G(M("meta","settings"),n),_N=async()=>{try{const n=await Xe(M("meta","expenseCategories"));if(n.exists()){const e=n.data();return Array.isArray(e.categories)?e.categories:[]}}catch{}return[]},yN=async n=>{await G(M("meta","expenseCategories"),{categories:n,updatedAt:Date.now()})},IN=async()=>{try{const n=await Xe(M("meta","incomeCategories"));if(n.exists()){const e=n.data();return Array.isArray(e.categories)?e.categories:[]}}catch{}return[]},wN=async n=>{await G(M("meta","incomeCategories"),{categories:n,updatedAt:Date.now()})},du=async n=>{const e=await we("transactions",{orderField:"date",includeDeleted:!!(n!=null&&n.includeDeleted)}),t=(n==null?void 0:n.role)||wd||"",r=n!=null&&n.buildingIds&&n.buildingIds.length>0?n.buildingIds:n!=null&&n.buildingId?[n.buildingId]:So;return t==="ADMIN"||t==="MANAGER"?e:r.length>0?e.filter(s=>$l(s,r)):[]},EN=n=>{try{const e=Ae(W("transactions"),ha("date","desc"));return zo(e,t=>{const r=Be(t||{docs:[]}),s=tw("transactions",r);n(s.filter(i=>!i.deleted))},t=>{console.error("listenTransactions error",t)})}catch(e){return console.error("listenTransactions setup error",e),()=>{}}},TN=async(n,e)=>{const t=$(n);on("transactions",He);let r;return n.id?r=await G(M("transactions",n.id),t):r=await X(W("transactions"),t),e!=null&&e.skipAmlakSheetSync||It(()=>aw(t),"Amlak Sheets transaction sync"),r},iw=async()=>we("amlakSheets",{orderField:"updatedAt"}),AN=n=>{try{const e=Ae(W("amlakSheets"),ha("updatedAt"));return zo(e,t=>{n(Be(t||{docs:[]}))},t=>{console.error("listenAmlakWorkbooks error",t),n([])})}catch(e){return console.error("listenAmlakWorkbooks setup error",e),()=>{}}},ow=async n=>{const e=wC(n),t=$({...e,updatedAt:Date.now()});return on("amlakSheets",He),n.id?G(M("amlakSheets",n.id),t):X(W("amlakSheets"),t)},aw=async n=>{if(!(n!=null&&n.id))return;const[e,t]=await Promise.all([iw().catch(()=>[]),ww({includeDeleted:!0}).catch(()=>fu({includeDeleted:!0})).catch(()=>[])]),r=qC(e,n,t);if(!r.changed)return;const s=new Set(r.syncedWorkbookIds);await Promise.all(r.workbooks.filter(i=>s.has(i.id)).map(i=>ow(i)))},vN=async n=>(on("amlakSheets",He),G(M("amlakSheets",n),{deleted:!0,updatedAt:Date.now()},{merge:!0})),bN=async(n,e)=>G(M("transactions",n),{status:e},{merge:!0}),SN=async n=>{const e=await du({includeDeleted:!0}).catch(()=>[]),t=iC(e,n==null?void 0:n.date,"CN-"),r={...n,id:crypto.randomUUID(),isCreditNote:!0,originalInvoiceId:n.vatInvoiceNumber,vatInvoiceNumber:t,amount:-Math.abs(n.amount||0),vatAmount:-Math.abs(n.vatAmount||0),totalWithVat:-Math.abs(n.totalWithVat||0),amountExcludingVAT:-Math.abs(n.amountExcludingVAT||0),amountIncludingVAT:-Math.abs(n.amountIncludingVAT||0),details:`Credit Note for ${n.vatInvoiceNumber||"Invoice"}${n.details?" - "+n.details:""}`,createdAt:Date.now()};return delete r.zatcaQRCode,delete r.zatcaReportedAt,delete r.zatcaStatus,await G(M("transactions",r.id),r),r},cw=async(n,e)=>{try{let t=null,r=null;try{const o=await Xe(M("transactions",n));o&&o.exists()&&(t={id:n,...o.data()},r=o.id)}catch{}if(!t){const o=Ae(W("transactions"),Ne("id","==",n)),a=await Y(o).catch(()=>null);if(a&&a.docs&&a.docs.length>0){const u=a.docs[0];t={id:u.id,...u.data()},r=u.id}}if(!(e!=null&&e.skipStockRestore)&&t&&Array.isArray(t.items)&&t.items.length>0)for(const o of t.items){if(!o||!o.stockId)continue;const a=Math.abs(o.qty||0);if(a)try{const u=await Xe(M("stocks",o.stockId)).catch(()=>null),l=u&&u.exists()&&u.data().quantity||0;await G(M("stocks",o.stockId),{quantity:l+a},{merge:!0}).catch(()=>{}),await X(W("stock_entries"),$({stockId:o.stockId,qty:a,unitPrice:o.unitPrice||0,total:0,by:t.createdBy||t.createdByName||"system",details:`Reversal of transaction ${n}`,date:new Date().toISOString(),transactionId:n})).catch(()=>{})}catch(u){console.error("restock on delete failed",u)}}await me(M("transactions",r||n)).catch(()=>{});const s=Ae(W("transactions"),Ne("id","==",n)),i=await Y(s).catch(()=>null);if(i&&i.docs&&i.docs.length>0)for(const o of i.docs)await me(M("transactions",o.id)).catch(()=>{});return await X(W("audit"),$({action:"DELETE_TRANSACTION",details:`Deleted transaction ${n}${t&&t.items?" (restocked items)":""}`,timestamp:Date.now()})).catch(()=>{}),!0}catch(t){throw console.error("deleteTransaction error",t),t}},RN=async(n,e)=>{const t=$({type:"transaction_delete",targetCollection:"transactions",targetId:e,requestedBy:n,requestedAt:Date.now(),status:"PENDING"}),r=await ga(t);return r.duplicate||(It(X(W("audit"),$({action:"REQUEST_DELETE",details:`Deletion requested for tx ${e}`,userId:n,timestamp:Date.now()})).catch(()=>{}),"approval audit"),It(async()=>{const{notifyAdminsOfRequest:s}=await Lt(async()=>{const{notifyAdminsOfRequest:o}=await import("./pushNotificationService-CScQq7DN.js");return{notifyAdminsOfRequest:o}},__vite__mapDeps([0,1,2]),import.meta.url),i=await Pi(n);s({approvalId:r.id,type:"transaction_delete",requestedBy:i,targetId:e}).catch(()=>{})},"approval notification")),r},fu=async n=>{const e=await we("buildings",{includeDeleted:!!(n!=null&&n.includeDeleted)}),t=r=>{const s=(r||"").match(/(\d+)/g);return!s||s.length===0?null:parseInt(s[s.length-1],10)};return(e||[]).slice().sort((r,s)=>{const i=(r==null?void 0:r.name)||"",o=(s==null?void 0:s.name)||"",a=t(i),u=t(o);return a!==null&&u!==null&&a!==u?a-u:a!==null&&u===null?-1:a===null&&u!==null?1:i.localeCompare(o,void 0,{sensitivity:"base"})})},PN=async n=>{const e=$(n);return on("buildings",He),n.id?G(M("buildings",n.id),e):X(W("buildings"),e)},kN=async n=>me(M("buildings",n)),CN=async n=>{const e=l=>n==="default"||!Ri.has(l)?l:`book_${n}_${l}`,t=l=>l.docs.map(h=>({id:h.id,...h.data()})),[r,s,i]=await Promise.all([Y(te(q(),e("buildings"))),Y(Ae(te(q(),e("transactions")),ha("date","desc"))).catch(()=>({docs:[]})),Y(te(q(),e("contracts")))]),o=t(r).filter(l=>!l.deleted),a=t(s).filter(l=>!l.deleted),u=t(i).filter(l=>!l.deleted);return{buildings:o,transactions:a,contracts:u}},NN=async(n,e,t,r)=>{const s=(f,p)=>f==="default"||!Ri.has(p)?p:`book_${f}_${p}`,i={},o=[];r==null||r("Transferring building record...");const a=We(q(),s(e,"buildings"),n),u=await Xe(a);if(!u.exists())throw new Error("Building not found in source book");const l={id:u.id,...u.data()};await G(We(q(),s(t,"buildings"),n),$(l)),await me(a),i.buildings=1;const h=["transactions","contracts","stock","stock_entries","stockItems","stockTransfers","utility_readings","security_deposits","ejar_contracts","service_agreements","sadad_bills"];for(const f of h){r==null||r(`Transferring ${f}...`);const p=s(e,f),_=s(t,f);try{const w=await Y(Ae(te(q(),p),Ne("buildingId","==",n)));let b=0;for(const C of w.docs){const V={id:C.id,...C.data()};await G(We(q(),_,C.id),$(V)),await me(C.ref),b++}b>0&&(i[f]=b)}catch(w){o.push(`${f}: ${(w==null?void 0:w.message)||String(w)}`)}}r==null||r("Transferring staff...");try{const f=await Y(te(q(),s(e,"users")));let p=0;for(const _ of f.docs){const w={id:_.id,..._.data()},b=w.buildingId===n&&(!w.buildingIds||w.buildingIds.length===0),C=Array.isArray(w.buildingIds)&&w.buildingIds.includes(n);if(!b&&!C)continue;const V=Array.isArray(w.buildingIds)?w.buildingIds.filter(L=>L!==n):[];if(b?!1:V.length>0){const L={...w,buildingIds:V,buildingId:V[0]||null};await G(_.ref,$(L))}else await G(We(q(),s(t,"users"),_.id),$(w)),await me(_.ref),p++}p>0&&(i.users=p)}catch(f){o.push(`users: ${(f==null?void 0:f.message)||String(f)}`)}return await X(te(q(),"audit"),$({action:"TRANSFER_BUILDING",details:`Building ${n} transferred from book '${e}' to book '${t}'`,userId:"system",timestamp:Date.now(),transferred:i})).catch(()=>{}),{transferred:i,errors:o}},DN=async(n,e,t)=>{const r={contracts:0,transactions:0,stockEntries:0},s=pr(q());return(await Y(Ae(W("contracts"),Ne("buildingId","==",n),Ne("unitName","==",e)))).forEach(u=>{s.update(u.ref,{unitName:t}),r.contracts++}),(await Y(Ae(W("transactions"),Ne("buildingId","==",n),Ne("unitName","==",e)))).forEach(u=>{s.update(u.ref,{unitName:t}),r.transactions++}),(await Y(Ae(W("stock"),Ne("buildingId","==",n),Ne("unitName","==",e)))).forEach(u=>{s.update(u.ref,{unitName:t}),r.stockEntries++}),await s.commit(),r},uw=async n=>{const e=!!(n!=null&&n.includeDeleted),t=`customers:${e}:${n!=null&&n.acrossBooks?"all":He}`,r=WI(t);if(r)return r;const s=n!=null&&n.acrossBooks?await lw({includeDeleted:e}):await we("customers",{includeDeleted:e}),i=a=>((a==null?void 0:a.nameEn)||(a==null?void 0:a.nameAr)||(a==null?void 0:a.name)||"").toString(),o=(s||[]).slice().sort((a,u)=>i(a).localeCompare(i(u),void 0,{sensitivity:"base"}));return HI(t,o),o},VN=async n=>{const e=$(n);fa("customers:"),on("customers",He);const t=Cn();if(!n.id){const r=await X(te(q(),"customers"),e),s=r.id;try{t&&t!=="default"&&await G(We(q(),`book_${t}_customers`,s),e)}catch{}return r}await G(We(q(),"customers",n.id),e);try{t&&t!=="default"&&await G(We(q(),`book_${t}_customers`,n.id),e)}catch{}return!0},ON=async n=>(fa("customers:"),on("customers",He),me(M("customers",n))),lw=async n=>{const e=!!(n!=null&&n.includeDeleted),t=i=>((i==null?void 0:i.docs)||[]).map(o=>({id:o.id,...o.data()})),r=i=>String(i??"").trim().replace(/\s+/g," ").toLowerCase(),s=i=>{const o=r((i==null?void 0:i.vatNumber)||(i==null?void 0:i.vatNo)||(i==null?void 0:i.vat)||(i==null?void 0:i.customerVATNumber));if(o)return`vat:${o}`;const a=r((i==null?void 0:i.phone)||(i==null?void 0:i.mobile)||(i==null?void 0:i.phoneNumber));if(a)return`phone:${a}`;const u=r(i==null?void 0:i.email);if(u)return`email:${u}`;const l=r((i==null?void 0:i.nameEn)||(i==null?void 0:i.nameAr)||(i==null?void 0:i.name)),h=r((i==null?void 0:i.roomNumber)||(i==null?void 0:i.room));return`name:${l}|room:${h}`};try{const i=q(),o=await Y(te(i,"customers")).catch(()=>({docs:[]})),a=t(o).map(w=>({...w,bookId:w.bookId||"global"})),u=await Y(te(i,"books")).catch(()=>({docs:[]})),l=((u==null?void 0:u.docs)||[]).map(w=>String(w.id)).filter(w=>w&&w!=="default"),h=l.length===0?[]:(await Promise.all(l.map(async w=>{const b=await Y(te(i,`book_${w}_customers`)).catch(()=>({docs:[]}));return t(b).map(C=>({...C,bookId:w}))}))).flat(),f=[...a,...h],p=e?f:f.filter(w=>!w.deleted);return Array.from(new Map(p.map(w=>[s(w),w])).values())}catch(i){return console.error("getCustomersAcrossBooks error",i),await we("customers",{includeDeleted:e}).catch(()=>[])}},Ed=async n=>we("users",{includeDeleted:!!(n!=null&&n.includeDeleted)}),xN=async(n,e)=>{if(!n)return null;try{const t=await Xe(M("users",n));if(!t.exists())return null;const r={id:t.id,...t.data()};return!(e!=null&&e.includeDeleted)&&r.deleted?null:r}catch{return null}},MN=async n=>{const e=!!(n!=null&&n.includeDeleted),t=s=>((s==null?void 0:s.docs)||[]).map(i=>({id:i.id,...i.data()})),r=s=>Array.from(new Map(s.map(i=>[String(i.id),i])).values());try{const s=await Y(te(q(),"users")).catch(()=>({docs:[]})),i=t(s).map(f=>({...f,bookId:f.bookId||"default"})),o=await Y(te(q(),"books")).catch(()=>({docs:[]})),a=((o==null?void 0:o.docs)||[]).map(f=>String(f.id)).filter(Boolean),u=(await Promise.all(a.map(async f=>{const p=await Y(te(q(),`book_${f}_users`)).catch(()=>({docs:[]}));return t(p).map(_=>({..._,bookId:f}))}))).flat(),l=r([...i,...u]);return e?l:l.filter(f=>!f.deleted)}catch(s){return console.error("getUsersAcrossBooks error",s),await Ed(n).catch(()=>[])}},LN=async n=>{let e={...n};e.password&&!/^[0-9a-f]{64}$/.test(e.password)&&(e.password=await ps(e.password));const t=$(e);return n.id?G(M("users",n.id),t):X(W("users"),t)},BN=async(n,e)=>{try{return new Promise((t,r)=>{const s=new FileReader;s.onloadend=async()=>{const i=s.result;localStorage.setItem(`profilePhoto_${n}`,i),await G(M("users",n),{photoURL:`localStorage:${n}`,photoUpdated:Date.now()},{merge:!0}),t(i)},s.onerror=()=>r(s.error),s.readAsDataURL(e)})}catch(t){throw console.error("Failed to upload profile photo:",t),t}},FN=n=>localStorage.getItem(`profilePhoto_${n}`),UN=async n=>me(M("users",n));async function ql(n,e){if(q(),n==="id"){const o=await Xe(pe("default","users",e));if(o.exists())return{user:{id:e,...o.data()},bookId:"default",colPath:"users"}}const t=Ae(js("default","users"),Ne(n,"==",e)),r=await Y(t),s=Be(r);if(s[0])return{user:s[0],bookId:"default",colPath:"users"};const i=new Set;try{(await Y(js("default","books"))).docs.forEach(a=>{a.id&&a.id!=="default"&&i.add(a.id)})}catch{}for(const o of i){if(n==="id"){const h=await Xe(pe(o,"users",e));if(h.exists())return{user:{id:e,...h.data()},bookId:o,colPath:`book_${o}_users`}}const a=Ae(js(o,"users"),Ne(n,"==",e)),u=await Y(a),l=Be(u);if(l[0])return{user:l[0],bookId:o,colPath:`book_${o}_users`}}return null}const $N=async n=>{const e=await ql("id",n);return e?{...e.user,bookId:e.bookId}:null},qN=async(n,e)=>{const t=await ql("firebaseUid",n);if(t)return{...t.user,bookId:t.bookId};if(e){const r=await ql("id",n);if(r)return{...r.user,bookId:r.bookId}}return null},jN=async(n,e)=>{try{const t=Ae(te(q(),"users"),Ne("id","==",n)),r=await Y(t),i=Be(r)[0];if(i&&await kc(e,i.password||"")&&i.hasSystemAccess!==!1){if(Fl(i))throw new Error(Ul);return{...i,bookId:"default"}}try{const l=await Y(te(q(),"books"));for(const h of l.docs){const f=h.id,p=Ae(te(q(),`book_${f}_users`),Ne("id","==",n)),_=await Y(p),b=Be(_)[0];if(b&&await kc(e,b.password||"")&&b.hasSystemAccess!==!1){if(Fl(b))throw new Error(Ul);return{...b,bookId:f}}}}catch{}const o=await Y(te(q(),"users"));if(!Be(o).some(l=>l.role==="ADMIN")){const l=await ps(e),h={id:n,name:"Admin",role:"ADMIN",status:"Active",hasSystemAccess:!0,password:l,createdAt:new Date().toISOString()};return await G(We(q(),"users",n),h),{...h,bookId:"default"}}return null}catch(t){throw console.error("mockLogin error",t),t}},GN=async(n,e,t)=>{const r=Ae(te(q(),"users"),Ne("id","==",n)),s=await Y(r);let o=Be(s)[0],a="users";if(!o)try{const l=await Y(te(q(),"books"));for(const h of l.docs){const f=`book_${h.id}_users`,p=Ae(te(q(),f),Ne("id","==",n)),_=await Y(p),w=Be(_);if(w[0]){o=w[0],a=f;break}}}catch{}if(!o)throw new Error("User not found");if(!await kc(e,o.password||""))throw new Error("Current password is incorrect");const u=await ps(t);await G(We(q(),a,o.id),{...o,password:u},{merge:!0});try{const{provisionStaffFirebaseAuth:l}=await Lt(async()=>{const{provisionStaffFirebaseAuth:h}=await import("./authService-BiH-DU5j.js").then(f=>f.a);return{provisionStaffFirebaseAuth:h}},[],import.meta.url);await l(n,t,a==="users"?"default":a.replace(/^book_/,"").replace(/_users$/,""))}catch(l){console.warn("Firebase auth sync after password change failed",l)}return!0},zN=async(n,e)=>{const t=Ae(te(q(),"users"),Ne("id","==",n)),r=await Y(t);let i=Be(r)[0],o="users";if(!i)try{const u=await Y(te(q(),"books"));for(const l of u.docs){const h=`book_${l.id}_users`,f=Ae(te(q(),h),Ne("id","==",n)),p=await Y(f),_=Be(p);if(_[0]){i=_[0],o=h;break}}}catch{}if(!i)throw new Error("User ID not found");const a=await ps(e);await G(We(q(),o,i.id),{password:a},{merge:!0});try{const{provisionStaffFirebaseAuth:u}=await Lt(async()=>{const{provisionStaffFirebaseAuth:h}=await import("./authService-BiH-DU5j.js").then(f=>f.a);return{provisionStaffFirebaseAuth:h}},[],import.meta.url),l=o==="users"?"default":o.replace(/^book_/,"").replace(/_users$/,"");await u(n,e,l)}catch(u){console.warn("Firebase auth sync after password reset request failed",u)}await X(W("audit"),$({action:"PASSWORD_RESET",details:`Password reset by ${i.name||n} (self-service)`,userId:n,timestamp:Date.now()})).catch(()=>{});try{const{notifyAdminsOfRequest:u}=await Lt(async()=>{const{notifyAdminsOfRequest:l}=await import("./pushNotificationService-CScQq7DN.js");return{notifyAdminsOfRequest:l}},__vite__mapDeps([0,1,2]),import.meta.url);u({approvalId:"password_reset_"+Date.now(),type:"password_reset",requestedBy:i.name||n,targetId:i.id}).catch(()=>{})}catch{}return!0},hw=async()=>{const n=await we("banks");if(He!=="default")try{const e=`book_${He}_banks`,t=await Y(te(q(),e)),r=Be(t).filter(s=>!s.deleted);if(r.length>0){const s=new Set(n.map(o=>String(o.id||""))),i=new Set(n.map(o=>`${String(o.name||"").trim().toLowerCase()}|${String(o.iban||"").trim().toLowerCase()}`));for(const o of r){const a=String(o.id||""),u=`${String(o.name||"").trim().toLowerCase()}|${String(o.iban||"").trim().toLowerCase()}`;if(s.has(a)||i.has(u))continue;const l=$({...o});delete l.id,a?await G(We(q(),"banks",a),l,{merge:!0}):await X(te(q(),"banks"),l)}return we("banks")}}catch{}return n},KN=async n=>{const e=$(n),t=n.name||n.id;return t?G(M("banks",t),e):X(W("banks"),e)},Cc=async n=>me(M("banks",n)),dw=async()=>{const e=(await Ci().catch(()=>[])||[]).map(t=>({id:String(t.id||"").trim(),name:String(t.name||t.id||"").trim()})).filter(t=>t.id);return e.some(t=>t.id==="default")||e.unshift({id:"default",name:"Main Book"}),e},ma=async(n,e)=>{const t=(e==null?void 0:e.includeDeleted)??!0,r=await dw(),s=await Promise.all(r.map(async i=>{try{vr(n);const o=ln(i.id,n);return((await Y(te(q(),o))).docs||[]).map(u=>({bookId:i.id,id:u.id,data:{id:u.id,...u.data()}})).filter(u=>{var l;return t||!((l=u.data)!=null&&l.deleted)})}catch{return[]}}));return{booksScanned:r.length,docs:s.flat()}},Zu=n=>n>=1024*1024*1024?`${(n/(1024*1024*1024)).toFixed(2)} GB`:n>=1024*1024?`${(n/(1024*1024)).toFixed(2)} MB`:n>=1024?`${(n/1024).toFixed(1)} KB`:`${n} B`,WN=(n,e,t)=>{const r=JSON.stringify({path:`${n}/${e}`,data:$(t)});return new Blob([r]).size},HN=async()=>{const n=await dw().catch(()=>[{id:"default",name:"Main Book"}]),t=(await Promise.all(iN.map(async s=>{try{const i=Ri.has(s),o=i?(await ma(s,{includeDeleted:!0})).docs:await(async()=>(vr(s),((await Y(te(q(),s))).docs||[]).map(l=>({bookId:"default",id:l.id,data:{id:l.id,...l.data()}}))))(),a=o.reduce((u,l)=>{const h=i?ln(l.bookId,s):s;return u+WN(h,l.id,l.data)},0);return{name:s,documents:o.length,bytes:a,sizeLabel:Zu(a)}}catch{return{name:s,documents:0,bytes:0,sizeLabel:Zu(0)}}}))).filter(s=>s.documents>0||s.bytes>0).sort((s,i)=>i.bytes-s.bytes),r=t.reduce((s,i)=>s+i.bytes,0);return{totalBytes:r,totalSizeLabel:Zu(r),totalSizeMB:Number((r/(1024*1024)).toFixed(2)),totalSizeGB:Number((r/(1024*1024*1024)).toFixed(3)),documentCount:t.reduce((s,i)=>s+i.documents,0),collectionCount:t.length,booksScanned:n.length,collections:t,estimatedAt:new Date().toISOString(),note:"Estimated from readable app documents. Firebase billed storage can be higher because Firestore adds document, field, path, and index overhead that the browser SDK cannot read exactly."}},nr=async(n,e,t,r,s)=>{const i=await ma(n,{includeDeleted:!0});let o=0,a=pr(q()),u=0;const l=async()=>{u!==0&&(await a.commit(),a=pr(q()),u=0)};for(const h of i.docs){const f=zC(h.data,e,t,{fields:r,includeVatReportSnapshot:!!(s!=null&&s.includeVatReportSnapshot)});f&&(a.set(pe(h.bookId,n,h.id),$(f),{merge:!0}),u++,o++,u>=450&&await l())}return await l(),o},QN=async()=>{const n=await ma("transactions",{includeDeleted:!1});return GC(n.docs.map(e=>e.data))},JN=async n=>{const e=Array.from(new Map((n.sourceBankNames||[]).map(w=>String(w||"").trim()).filter(Boolean).map(w=>[xt(w),w])).values()),t=String(n.targetBankName||"").trim();if(e.length<2)throw new Error("Select two bank accounts to merge.");if(!t)throw new Error("Select the merged bank account.");const r=e.map(xt);if(new Set(r).size!==e.length)throw new Error("Select two different source bank accounts.");const s=xt(t),i=e.filter(w=>xt(w)!==s),o=["bankName","fromBankName","toBankName"],a=["bankName"],[u,l,h,f,p]=await Promise.all([nr("transactions",i,t,o,{includeVatReportSnapshot:!0}),nr("transfers",i,t,o),nr("buildings",i,t,a),nr("bank_statements",i,t,a),ma("transactions",{includeDeleted:!1})]),_=[];if(n.removeMergedBanks!==!1)for(const w of e)xt(w)!==s&&(await Cc(w).catch(()=>{}),_.push(w));return fa("col:"),await X(te(q(),"audit"),$({action:"MERGE_BANK_ACCOUNTS",details:`Merged ${e.join(" + ")} into ${t}`,userId:n.updatedBy||"system",timestamp:Date.now(),transactionsUpdated:u,transfersUpdated:l,buildingsUpdated:h,bankStatementsUpdated:f,banksRemoved:_})).catch(()=>{}),{transactionsUpdated:u,transfersUpdated:l,buildingsUpdated:h,bankStatementsUpdated:f,banksRemoved:_,booksScanned:p.booksScanned}},YN=async(n,e,t)=>{const r=String(n||"").trim(),s=String((e==null?void 0:e.name)||"").trim(),i=String((e==null?void 0:e.id)||"").trim(),o=i||s;if(!r)throw new Error("Original bank name is missing.");if(!s)throw new Error("Bank name is required.");const a=$({...e,id:o,name:s,iban:(e==null?void 0:e.iban)||""});await G(M("banks",o),a);const u=r!==s,l=xt(r)!==xt(s),h=!i&&u;if(!l)return h&&await Cc(r).catch(()=>{}),on("banks",He),{renamed:u,transactionsUpdated:0,transfersUpdated:0,buildingsUpdated:0,bankStatementsUpdated:0,banksRemoved:h?[r]:[],booksScanned:0};const f=["bankName","fromBankName","toBankName"],p=["bankName"],[_,w,b,C,V]=await Promise.all([nr("transactions",[r],s,f,{includeVatReportSnapshot:!0}),nr("transfers",[r],s,f),nr("buildings",[r],s,p),nr("bank_statements",[r],s,p),ma("transactions",{includeDeleted:!1})]);return h&&await Cc(r).catch(()=>{}),on("banks",He),on("transactions",He),await X(te(q(),"audit"),$({action:"UPDATE_BANK_ACCOUNT",details:`Renamed bank ${r} to ${s}`,userId:t||"system",timestamp:Date.now(),transactionsUpdated:_,transfersUpdated:w,buildingsUpdated:b,bankStatementsUpdated:C})).catch(()=>{}),{renamed:!0,transactionsUpdated:_,transfersUpdated:w,buildingsUpdated:b,bankStatementsUpdated:C,banksRemoved:h?[r]:[],booksScanned:V.booksScanned}},pa=async n=>we("contracts",{includeDeleted:!!(n!=null&&n.includeDeleted)}),XN=async n=>{const e=$(n);return on("contracts",He),n.id?G(M("contracts",n.id),e):X(W("contracts"),e)},ZN=async n=>me(M("contracts",n)),eD=async(n,e)=>{const{contractIncludesUnit:t}=await Lt(async()=>{const{contractIncludesUnit:s}=await import("./contractUnits--AD3R8n2.js");return{contractIncludesUnit:s}},[],import.meta.url);return(await pa({includeDeleted:!0})).some(s=>s.buildingId===n&&s.status==="Active"&&!s.deleted&&t(s.unitName,e))},tD=async(n,e)=>{const{contractIncludesUnit:t,pickBestContractForUnit:r}=await Lt(async()=>{const{contractIncludesUnit:o,pickBestContractForUnit:a}=await import("./contractUnits--AD3R8n2.js");return{contractIncludesUnit:o,pickBestContractForUnit:a}},[],import.meta.url),i=(await pa({includeDeleted:!0})).filter(o=>o.buildingId===n&&!o.deleted&&t(o.unitName,e));return r(i)||null},nD=async()=>{const n=await fu(),e=await pa();let t=0;n.forEach(s=>t+=(s.units||[]).length);const r=e.filter(s=>s.status==="Active").length;return{totalUnits:t,occupiedUnits:r,percentage:t>0?Math.round(r/t*100):0}},rD=async()=>(await we("audit")).slice(0,100),sD=async()=>{const[n,e,t,r,s,i,o,a,u]=await Promise.all([du(),uw(),pa(),fu(),Ed(),nw(),sw(),rw(),hw()]),l={transactions:n,customers:e,contracts:t,buildings:r,users:s,vendors:i,settings:o,tasks:a,banks:u,timestamp:new Date().toISOString()};return JSON.stringify(l)},fw=async n=>{try{const e=JSON.parse(n),t=async(r,s)=>{if(!(!s||!Array.isArray(s)))for(const i of s){const o=i.id||void 0;o?await G(M(r,o),i).catch(()=>{}):await X(W(r),i).catch(()=>{})}};return await t("transactions",e.transactions||[]),await t("customers",e.customers||[]),await t("contracts",e.contracts||[]),await t("buildings",e.buildings||[]),await t("users",e.users||[]),await t("vendors",e.vendors||[]),e.settings&&await G(M("meta","settings"),e.settings).catch(()=>{}),await t("tasks",e.tasks||[]),await t("banks",e.banks||[]),!0}catch(e){return console.error("restore failed",e),!1}},iD=async()=>{try{localStorage.clear(),sessionStorage.clear()}catch{}const n=["transactions","customers","contracts","buildings","users","vendors","tasks","banks","audit","approvals","stocks","stockItems","stockTransfers","images","registry","notifications","meta","transfers","service_agreements","stock_entries"];for(const e of n){const t=await Y(W(e)).catch(()=>null);if(t)for(const r of t.docs)await me(M(e,r.id)).catch(()=>{})}await me(M("meta","settings")).catch(()=>{}),window.location.reload()};function mw(n){const e=new Map;for(const t of n||[]){if(!(t!=null&&t.type)||!(t!=null&&t.targetId))continue;const r=`${t.type}|${t.targetId}`,s=e.get(r);(!s||Number(t.requestedAt||0)>Number(s.requestedAt||0))&&e.set(r,t)}return Array.from(e.values()).sort((t,r)=>Number(r.requestedAt||0)-Number(t.requestedAt||0))}async function pw(n,e){const t=Ae(W("approvals"),Ne("status","==","PENDING")),r=await Y(t).catch(()=>null);if(!r)return null;const s=r.docs.find(i=>{const o=i.data();return o.type===n&&o.targetId===e});return s?{id:s.id}:null}async function ga(n){const e=String(n.type||""),t=String(n.targetId||""),r=await pw(e,t);return r?{id:r.id,duplicate:!0}:{id:(await X(W("approvals"),n)).id}}const oD=async(n,e)=>!!await pw(n,e),aD=async(n,e,t)=>{const r=$({type:"transaction_edit",targetCollection:"transactions",targetId:e,payload:t,requestedBy:n,requestedAt:Date.now(),status:"PENDING"}),s=await ga(r);return s.duplicate||(It(X(W("audit"),$({action:"REQUEST_EDIT",details:`Edit requested for tx ${e}`,userId:n,timestamp:Date.now()})).catch(()=>{}),"approval audit"),It(async()=>{const{notifyAdminsOfRequest:i}=await Lt(async()=>{const{notifyAdminsOfRequest:a}=await import("./pushNotificationService-CScQq7DN.js");return{notifyAdminsOfRequest:a}},__vite__mapDeps([0,1,2]),import.meta.url),o=await Pi(n);i({approvalId:s.id,type:"transaction_edit",requestedBy:o,targetId:e}).catch(()=>{})},"approval notification")),s},cD=async(n="PENDING")=>{const e=await we("approvals","requestedAt");return n?e.filter(t=>(t.status||"PENDING")===n):e},uD=(n,e="PENDING")=>{try{const t=W("approvals"),r=e&&e!=="ALL"?Ae(t,Ne("status","==",e)):t;return zo(r,i=>{try{const o=Be(i||{docs:[]}),a=mw((o||[]).filter(u=>!e||e==="ALL"?!0:(u.status||"PENDING")===e));rN(a),n(a)}catch(o){console.error("listenApprovals snapshot processing error",o),n([])}},i=>{console.error("listenApprovals error",i),n([])})}catch(t){return console.error("listenApprovals setup error",t),()=>{}}},lD=async(n,e,t)=>{var o;const r=M("approvals",n),s=await Xe(r).catch(()=>null);if(!s||!s.exists())throw new Error("Approval request not found");const i={id:s.id,...s.data()};if(!t)return await me(r).catch(()=>G(r,{handledBy:e,handledAt:Date.now(),status:"REJECTED"},{merge:!0})),It(X(W("audit"),$({action:"REJECT_REQUEST",details:`Approval rejected for ${n}`,userId:e,timestamp:Date.now()})).catch(()=>{}),"approval audit"),!0;try{if(i.type==="transaction_delete"&&i.targetCollection==="transactions"&&i.targetId)await cw(i.targetId);else if(i.type==="transaction_edit"&&i.payload&&i.targetCollection&&i.targetId){const a=$(i.payload);await G(M(i.targetCollection,i.targetId),a,{merge:!0})}else if(i.type==="contract_finalize"&&i.payload&&i.targetCollection==="contracts"&&i.targetId){const a=$(i.payload);await G(M(i.targetCollection,i.targetId),a,{merge:!0})}else if(i.type==="contract_reverse"&&i.payload&&i.targetCollection==="contracts"&&i.targetId){const a=$(i.payload);await G(M(i.targetCollection,i.targetId),a,{merge:!0})}else if(i.type==="contract_delete"&&i.payload&&i.targetCollection==="contracts"&&i.targetId){const a=$(i.payload);await G(M(i.targetCollection,i.targetId),a,{merge:!0})}else if(i.type==="password_reset"&&((o=i.payload)!=null&&o.newPassword)&&i.targetId){let a="users";const u=Ae(te(q(),"users"),Ne("id","==",i.targetId));if((await Y(u)).empty)try{const p=await Y(te(q(),"books"));for(const _ of p.docs){const w=`book_${_.id}_users`,b=Ae(te(q(),w),Ne("id","==",i.targetId));if(!(await Y(b)).empty){a=w;break}}}catch{}const h=String(i.payload.newPassword||""),f=/^[0-9a-f]{64}$/i.test(h)?h:await ps(h);if(await G(We(q(),a,i.targetId),{password:f},{merge:!0}),h&&h.length>=6)try{const{provisionStaffFirebaseAuth:p}=await Lt(async()=>{const{provisionStaffFirebaseAuth:w}=await import("./authService-BiH-DU5j.js").then(b=>b.a);return{provisionStaffFirebaseAuth:w}},[],import.meta.url),_=a==="users"?"default":a.replace(/^book_/,"").replace(/_users$/,"");await p(i.targetId,h,_)}catch(p){console.warn("Firebase auth sync after approved password reset failed",p)}}else if(i.payload&&i.targetCollection&&i.targetId){const a=$(i.payload);await G(M(i.targetCollection,i.targetId),a,{merge:!0})}}catch(a){throw console.error("apply approval payload error",a),new Error(`Approval action failed: ${(a==null?void 0:a.message)||"Unknown error"}`)}return await me(r).catch(()=>G(r,{handledBy:e,handledAt:Date.now(),status:"APPROVED"},{merge:!0})),It(X(W("audit"),$({action:"APPROVE_REQUEST",details:`Approval approved for ${n}`,userId:e,timestamp:Date.now()})).catch(()=>{}),"approval audit"),!0},hD=async(n,e)=>{try{return vr("userTokens"),await G(M("userTokens",e),{userId:n,token:e,updatedAt:Date.now(),platform:typeof navigator<"u"?navigator.userAgent:"unknown"}),!0}catch(t){return console.error("saveUserToken error",t),null}},Pi=async n=>{try{const e=await Xe(M("users",n));if(e.exists())return e.data().name||n;if(He!=="default"){const t=await Xe(We(q(),"users",n));if(t.exists())return t.data().name||n}}catch{}return n},dD=async()=>{const n=await Y(te(q(),"users")),e=Be(n).filter(r=>!r.deleted).map(r=>({...r,bookId:r.bookId||"default"})),t=new Set(e.map(r=>r.id));try{const r=await Y(te(q(),"books"));for(const s of r.docs){const i=s.id,o=await Y(te(q(),`book_${i}_users`));for(const a of Be(o))!a.deleted&&!t.has(a.id)&&(t.add(a.id),e.push({...a,bookId:i}))}}catch{}return e},fD=async(n,e,t)=>{const r=$({type:"contract_finalize",targetCollection:"contracts",targetId:e,payload:t,requestedBy:n,requestedAt:Date.now(),status:"PENDING"}),s=await ga(r);return s.duplicate||(It(X(W("audit"),$({action:"REQUEST_CONTRACT_FINALIZE",details:`Finalize requested for contract ${e}`,userId:n,timestamp:Date.now()})).catch(()=>{}),"approval audit"),It(async()=>{const{notifyAdminsOfRequest:i}=await Lt(async()=>{const{notifyAdminsOfRequest:a}=await import("./pushNotificationService-CScQq7DN.js");return{notifyAdminsOfRequest:a}},__vite__mapDeps([0,1,2]),import.meta.url),o=await Pi(n);i({approvalId:s.id,type:"contract_finalize",requestedBy:o,targetId:e}).catch(()=>{})},"approval notification")),s},mD=async(n,e,t)=>{const r=$({type:"contract_reverse",targetCollection:"contracts",targetId:e,payload:t,requestedBy:n,requestedAt:Date.now(),status:"PENDING"}),s=await ga(r);return s.duplicate||(It(X(W("audit"),$({action:"REQUEST_CONTRACT_REVERSE",details:`Reverse finalize requested for contract ${e}`,userId:n,timestamp:Date.now()})).catch(()=>{}),"approval audit"),It(async()=>{const{notifyAdminsOfRequest:i}=await Lt(async()=>{const{notifyAdminsOfRequest:a}=await import("./pushNotificationService-CScQq7DN.js");return{notifyAdminsOfRequest:a}},__vite__mapDeps([0,1,2]),import.meta.url),o=await Pi(n);i({approvalId:s.id,type:"contract_reverse",requestedBy:o,targetId:e}).catch(()=>{})},"approval notification")),s},pD=async(n,e,t)=>{const r=$({type:"contract_delete",targetCollection:"contracts",targetId:e,payload:t,requestedBy:n,requestedAt:Date.now(),status:"PENDING"}),s=await ga(r);return s.duplicate||(It(X(W("audit"),$({action:"REQUEST_CONTRACT_DELETE",details:`Delete requested for contract ${e}`,userId:n,timestamp:Date.now()})).catch(()=>{}),"approval audit"),It(async()=>{const{notifyAdminsOfRequest:i}=await Lt(async()=>{const{notifyAdminsOfRequest:a}=await import("./pushNotificationService-CScQq7DN.js");return{notifyAdminsOfRequest:a}},__vite__mapDeps([0,1,2]),import.meta.url),o=await Pi(n);i({approvalId:s.id,type:"contract_delete",requestedBy:o,targetId:e}).catch(()=>{})},"approval notification")),s},gD=async n=>we("stocks",{includeDeleted:!!(n!=null&&n.includeDeleted)}),_D=async()=>we("stock_entries",{orderField:"date"}),yD=async n=>{const e=$(n);return n.id?G(M("stocks",n.id),e):X(W("stocks"),e)},ID=async n=>{try{return await me(M("stocks",n)),await X(W("audit"),$({action:"DELETE_STOCK",details:`Deleted stock item ${n}`,timestamp:Date.now()})).catch(()=>{}),!0}catch(e){return console.error("Delete stock error",e),!1}},wD=async(n,e)=>{if(!(!n||!Array.isArray(n.items)||n.items.length===0))for(const t of n.items){if(!(t!=null&&t.stockId))continue;const r=Math.abs(t.qty||0);if(r)try{vr("stocks");const s=await Xe(M("stocks",t.stockId)).catch(()=>null),i=s!=null&&s.exists()&&s.data().quantity||0,o=s!=null&&s.exists()?s.data().name||t.name||"":t.name||"";await G(M("stocks",t.stockId),{quantity:i+r},{merge:!0}).catch(()=>{}),await X(W("stock_entries"),$({stockId:t.stockId,stockName:o,qty:r,unitPrice:t.unitPrice||0,by:e,details:"Reversal — transaction deleted",date:new Date().toISOString()})).catch(()=>{})}catch(s){console.error("restoreStockFromTransaction error",s)}}},ED=async(n,e)=>{if(!(!n||!Array.isArray(n.items)||n.items.length===0))for(const t of n.items){if(!(t!=null&&t.stockId))continue;const r=Math.abs(t.qty||0);if(r)try{vr("stocks");const s=await Xe(M("stocks",t.stockId)).catch(()=>null),i=s!=null&&s.exists()&&s.data().quantity||0,o=s!=null&&s.exists()?s.data().name||t.name||"":t.name||"";await G(M("stocks",t.stockId),{quantity:Math.max(0,i-r)},{merge:!0}).catch(()=>{}),await X(W("stock_entries"),$({stockId:t.stockId,stockName:o,qty:-r,unitPrice:t.unitPrice||0,by:e,details:"Re-deduction — transaction restored from trash",date:new Date().toISOString()})).catch(()=>{})}catch(s){console.error("redeductStockFromTransaction error",s)}}},TD=async(n,e,t,r,s)=>{M("stocks",n);const i=await Y(Ae(W("stocks"),Ne("__name__","==",n))).catch(()=>null);let o=0,a=s;if(i&&i.docs&&i.docs.length>0){const l=i.docs[0];o=l.data().quantity||0,a||(a=l.data().name||void 0);const h=Math.max(0,o-Math.abs(e));await G(M("stocks",n),{quantity:h},{merge:!0}).catch(()=>{})}const u=$({stockId:n,stockName:a||"",qty:-Math.abs(e),by:t,details:r,date:new Date().toISOString()});return await X(W("stock_entries"),u).catch(()=>{}),await X(W("audit"),$({action:"CONSUME_STOCK",details:`Consumed ${e} from ${a||n}`,userId:t,timestamp:Date.now()})).catch(()=>{}),!0},AD=async(n,e,t,r)=>{const s=$({stockId:n,qty:Math.abs(e),by:t,details:r,date:new Date().toISOString()});return await X(W("stock_entries"),s).catch(()=>{}),!0},vD=async(n,e)=>{try{const t=await Xe(M("stock_entries",n)).catch(()=>null);if(!t||!t.exists())return!1;const r={id:n,...t.data()},s=r.qty||0;if(s!==0&&r.stockId){const i=await Xe(M("stocks",r.stockId)).catch(()=>null);if(i&&i.exists()){const a=(i.data().quantity||0)-s;await G(M("stocks",r.stockId),{quantity:Math.max(0,a)},{merge:!0}).catch(()=>{});const u=$({stockId:r.stockId,stockName:r.stockName||"",qty:-s,by:e,details:`Reversal of ${r.details||"entry"}`,date:new Date().toISOString()});await X(W("stock_entries"),u).catch(()=>{})}}return await me(M("stock_entries",n)).catch(()=>{}),await X(W("audit"),$({action:"DELETE_STOCK_ENTRY",details:`Reversed stock entry ${n}`,userId:e,timestamp:Date.now()})).catch(()=>{}),!0}catch(t){return console.error("deleteStockEntry error",t),!1}},bD=async(n,e,t={})=>{const r=!!t.isFree;let s=0;for(const i of e){const o=await Y(Ae(W("stocks"),Ne("__name__","==",i.stockId))).catch(()=>null);let a=0;if(o&&o.docs&&o.docs.length>0){a=o.docs[0].data().quantity||0;const p=Math.max(0,a-Math.abs(i.qty));await G(M("stocks",i.stockId),{quantity:p},{merge:!0}).catch(()=>{})}const u=r?0:i.unitPrice||0,l=u*i.qty;s+=l;const h=$({stockId:i.stockId,stockName:i.name||"",qty:-Math.abs(i.qty),unitPrice:u,total:l,by:n,details:r?"Free stock issue (quantity deducted)":t.customerName?`Sold to ${t.customerName}`:"Stock Sale",date:new Date().toISOString(),buildingId:t.buildingId,unitNumber:t.unitNumber,contractId:t.contractId,customerId:t.customerId});await X(W("stock_entries"),h).catch(()=>{})}if(r){const i=$({id:crypto.randomUUID(),date:new Date().toISOString().split("T")[0],type:"INFO",amount:0,paymentMethod:"FREE",bankName:t.bankName,buildingId:t.buildingId,buildingName:t.buildingName,unitNumber:t.unitNumber,contractId:t.contractId,customerId:t.customerId,customerName:t.customerName,details:`Free stock issue${t.buildingName?" for "+t.buildingName:t.customerName?" to "+t.customerName:""}`,items:e.map(o=>({stockId:o.stockId,qty:o.qty,unitPrice:0})),isStockIssue:!0,createdAt:Date.now(),createdBy:n,createdByName:t.createdByName||"",status:"LOGGED"});try{await G(M("transactions",i.id),i),await X(W("audit"),$({action:"FREE_STOCK",details:"Free stock issued (qty deducted)",userId:n,timestamp:Date.now()})).catch(()=>{})}catch(o){console.error("sellStockItems free transaction error",o)}return{total:0}}if(t.isPaid&&s>0){const i=t.txStatus||"APPROVED",o=$({id:crypto.randomUUID(),date:new Date().toISOString().split("T")[0],type:"INCOME",amount:s,paymentMethod:t.paymentMethod||"CASH",bankName:t.bankName,buildingId:t.buildingId,buildingName:t.buildingName,unitNumber:t.unitNumber,contractId:t.contractId,customerId:t.customerId,customerName:t.customerName,details:`Stock Sale${t.customerName?" to "+t.customerName:t.customerId?" to "+t.customerId:""}`,items:e.map(a=>({stockId:a.stockId,qty:a.qty,unitPrice:a.unitPrice||0})),isStockIssue:!0,createdAt:Date.now(),createdBy:n,createdByName:t.createdByName||"",status:i});try{o.id?await G(M("transactions",o.id),o):await X(W("transactions"),o),await X(W("audit"),$({action:"STOCK_SALE",details:`Sold items total ${s}`,userId:n,timestamp:Date.now()})).catch(()=>{})}catch(a){console.error("sellStockItems error",a)}}else(!t.isPaid||s===0)&&await X(W("audit"),$({action:"STOCK_TRANSFER",details:"Stock transfer (unpaid/free) - items processed but no income recorded",userId:n,timestamp:Date.now()})).catch(()=>{});return{total:s}},SD=async(n,e)=>{if(!n)throw new Error("Missing invoice number");const t=`invoices/${n}.pdf`,r=Hk(kI,t);await Kk(r,e,{contentType:"application/pdf"});const s=await Wk(r);try{const i=Ae(W("transactions"),Ne("vatInvoiceNumber","==",n)),o=await Y(i);if(o&&o.docs&&o.docs.length>0){const a=o.docs[0].id;await G(M("transactions",a),{invoicePdfUrl:s},{merge:!0})}}catch(i){console.error("Failed to attach invoicePdfUrl to transaction",i)}return s},RD=(n,e,t)=>!e&&!t?!0:!(e&&n<e||t&&n>t),ki=async(n,e,t)=>(await du()).filter(s=>!(t&&s.buildingId&&s.buildingId!==t||!RD(s.date,n,e))),PD=async(n,e,t,r)=>(await ki(e,t,r)).filter(i=>i.type===n).reduce((i,o)=>i+(Number(o.amount)||0),0),gw=async(n,e,t)=>{const r=await ki(n,e,t),s=r.filter(o=>o.type==="INCOME").reduce((o,a)=>o+(Number(a.amount)||0),0),i=r.filter(o=>o.type==="EXPENSE").reduce((o,a)=>o+(Number(a.amount)||0),0);return{income:s,expense:i,net:s-i}},_w=async(n,e,t,r)=>{const s=await ki(e,t,r),i={},o=a=>n==="monthly"?a.slice(0,7):n==="yearly"?a.slice(0,4):a;for(const a of s){const u=o(a.date||"");i[u]||(i[u]={income:0,expense:0}),a.type==="INCOME"&&(i[u].income+=Number(a.amount)||0),a.type==="EXPENSE"&&(i[u].expense+=Number(a.amount)||0)}return Object.keys(i).sort().map(a=>({period:a,income:i[a].income,expense:i[a].expense,net:i[a].income-i[a].expense}))},yw=async(n,e,t)=>{const s=(await ki(n,e)).filter(o=>o.type==="EXPENSE"&&(o.expenseCategory==="Salary"||o.expenseCategory==="SALARY")),i={};for(const o of s){const a=o.employeeId||"unknown";t&&a!==t||(i[a]||(i[a]={name:o.employeeName||a,total:0,items:[]}),i[a].total+=Number(o.amount)||0,i[a].items.push(o))}return Object.keys(i).map(o=>({employeeId:o,employeeName:i[o].name,total:i[o].total,items:i[o].items}))},Iw=async(n,e,t)=>{const s=(await ki(n,e,t)).filter(o=>o.type==="EXPENSE"&&(o.expenseCategory==="Maintenance"||o.expenseCategory==="MAINTENANCE"));return{total:s.reduce((o,a)=>o+(Number(a.amount)||0),0),items:s}},kD=async(n={})=>{const{startDate:e,endDate:t,buildingId:r}=n,s=await gw(e,t,r),i=await _w("monthly",e,t,r),o=await yw(e,t),a=await Iw(e,t,r);return{summary:s,monthly:i,salary:o,maintenance:a}},CD=async n=>we("transfers",{orderField:"createdAt",includeDeleted:!!(n!=null&&n.includeDeleted)}),ND=async(n,e)=>{const t=ln(n,"transfers"),r=!!(e!=null&&e.includeDeleted);try{const s=te(q(),t);let i;try{i=await Y(Ae(s,ha("createdAt","desc")))}catch{i=await Y(s)}const o=Be(i);return r?o:o.filter(a=>!a.deleted)}catch{return[]}},DD=async n=>{const e=$(n);try{const t=pr(q()),r=Cn(),s=n.toType==="HEAD_OFFICE"||n.fromType==="HEAD_OFFICE",i=n.fromType==="BUILDING"&&n.toType==="OWNER"||n.fromType==="OWNER"&&n.toType==="BUILDING",o=n.fromType==="BUILDING"&&n.toType==="BUILDING"&&n.fromId&&n.toId&&n.fromId!==n.toId,a=s||i,u=n.fromType==="BUILDING"?os(n.fromId,r):{bookId:r,rawId:n.fromId},l=n.toType==="BUILDING"?os(n.toId,r):{bookId:r,rawId:n.toId},h=new Set([r]);o&&(h.add(u.bookId),h.add(l.bookId));const f=n.id?pe(r,"transfers",n.id):pe(r,"transfers");let p=null,_=null,w=null,b=null;if(a){const V=n.fromType==="BUILDING"?u.bookId:n.toType==="BUILDING"?l.bookId:r,O=n.fromType==="BUILDING"?u.rawId:n.toType==="BUILDING"?l.rawId:void 0;p=n.transactionId?pe(V,"transactions",n.transactionId):pe(V,"transactions");let L="OTHER";n.fromType==="BUILDING"&&(n.toType==="HEAD_OFFICE"||n.toType==="OWNER")?L="EXPENSE":(n.fromType==="HEAD_OFFICE"||n.fromType==="OWNER")&&n.toType==="BUILDING"&&(L="INCOME"),_=$({id:p.id,date:n.date||new Date().toISOString().split("T")[0],type:L,amount:Number(n.amount)||0,paymentMethod:"TREASURY",originalPaymentMethod:n.paymentMethod||void 0,fromBankName:n.fromBankName||(n.paymentMethod==="BANK"||n.paymentMethod==="CHEQUE"?n.bankName:void 0)||void 0,toBankName:n.toBankName||void 0,bankName:n.fromBankName||n.bankName||void 0,fromType:n.fromType,toType:n.toType,fromId:n.fromId,toId:n.toId,purpose:n.purpose||n.notes||"Treasury Transfer",details:n.notes||"",status:n.status||"APPROVED",transferId:f.id,createdBy:n.createdBy,createdAt:n.createdAt||Date.now(),source:"treasury",buildingId:O,buildingBookId:V,buildingName:void 0})}if(o){const V=n.purpose||n.notes||"Inter-Building Transfer",O=n.notes||V;p=n.transactionId?pe(u.bookId,"transactions",n.transactionId):pe(u.bookId,"transactions"),w=n.transactionIdDest?pe(l.bookId,"transactions",n.transactionIdDest):pe(l.bookId,"transactions");const L={date:n.date||new Date().toISOString().split("T")[0],amount:Number(n.amount)||0,paymentMethod:"TREASURY",originalPaymentMethod:n.paymentMethod||void 0,fromBankName:n.fromBankName||(n.paymentMethod==="BANK"||n.paymentMethod==="CHEQUE"?n.bankName:void 0)||void 0,toBankName:n.toBankName||void 0,bankName:n.fromBankName||n.bankName||void 0,fromType:n.fromType,toType:n.toType,fromId:n.fromId,toId:n.toId,fromName:n.fromName||void 0,toName:n.toName||void 0,purpose:V,details:O,status:n.status||"APPROVED",transferId:f.id,createdBy:n.createdBy,createdByName:n.createdByName,createdAt:n.createdAt||Date.now(),source:"treasury"};_=$({...L,id:p.id,type:"EXPENSE",expenseCategory:"Inter-Building Transfer",expenseSubCategory:n.toName||n.toId||void 0,buildingId:u.rawId,buildingBookId:u.bookId,interBuildingRole:"SOURCE",interBuildingPeerTxId:w.id,interBuildingPeerBookId:l.bookId}),b=$({...L,id:w.id,type:"INCOME",incomeSubType:"OTHER",expenseCategory:"Inter-Building Transfer",expenseSubCategory:n.fromName||n.fromId||void 0,buildingId:l.rawId,buildingBookId:l.bookId,interBuildingRole:"DEST",interBuildingPeerTxId:p.id,interBuildingPeerBookId:u.bookId})}const C=$({...e,id:f.id,transactionId:p?p.id:n.transactionId||void 0,transactionIdDest:w?w.id:o&&n.transactionIdDest||void 0,sourceBookId:o?u.bookId:a?n.fromType==="BUILDING"?u.bookId:n.toType==="BUILDING"?l.bookId:r:r,destBookId:o?l.bookId:void 0,originBookId:r});return h.forEach(V=>{const O=pe(V,"transfers",f.id);t.set(O,C)}),_&&p&&t.set(p,_),b&&w&&t.set(w,b),await t.commit(),[_,b].filter(Boolean).forEach(V=>{It(()=>aw(V),"Amlak Sheets treasury sync")}),{id:f.id,transactionId:p?p.id:void 0,transactionIdDest:w?w.id:void 0}}catch(t){return console.error("saveTransfer error",t),n.id?G(M("transfers",n.id),e):X(W("transfers"),e)}},VD=async()=>{try{const n=Cn();let e=[n];try{(await Y(te(q(),"books"))).docs.forEach(h=>{e.includes(h.id)||e.push(h.id)})}catch{}e.includes("default")||e.push("default");const t=await Promise.all(e.map(async l=>{try{const[h,f]=await Promise.all([Y(js(l,"transfers")),Y(js(l,"transactions"))]);return{bookId:l,transfers:h.docs.map(p=>({id:p.id,...p.data(),_bookId:l})),transactions:f.docs.map(p=>({id:p.id,...p.data(),_bookId:l}))}}catch{return{bookId:l,transfers:[],transactions:[]}}})),r=new Map;t.forEach(({transfers:l})=>{(l||[]).forEach(h=>{if(!h||h.deleted||!(h.fromType==="BUILDING"&&h.toType==="BUILDING"&&h.fromId&&h.toId&&h.fromId!==h.toId))return;const f=r.get(h.id);if(!f)r.set(h.id,h);else{const p=_=>(_.sourceBookId?1:0)+(_.destBookId?1:0)+(_.transactionId?1:0)+(_.transactionIdDest?1:0);p(h)>p(f)&&r.set(h.id,h)}})});const s=Array.from(r.values());if(s.length===0)return 0;const i=new Map;t.forEach(({transactions:l})=>{(l||[]).forEach(h=>{if(!h||!h.transferId)return;const f=i.get(h.transferId)||[];f.push(h),i.set(h.transferId,f)})});const o=pr(q());let a=0;const u=l=>String(l||"").trim().toLowerCase();for(const l of s){const h=os(l.fromId,l.sourceBookId||l.originBookId||n),f=os(l.toId,l.destBookId||l.sourceBookId||n),p=i.get(l.id)||[],_=p.find(H=>H._bookId===h.bookId&&u(H.buildingId)===u(h.rawId)),w=p.find(H=>H._bookId===f.bookId&&u(H.buildingId)===u(f.rawId));let b=!!_,C=!!w;for(const H of p)if(!(H===_||H===w)){if(!b&&H._bookId===h.bookId){o.set(pe(h.bookId,"transactions",H.id),$({buildingId:h.rawId,buildingBookId:h.bookId,type:"EXPENSE",expenseCategory:"Inter-Building Transfer",expenseSubCategory:l.toName||l.toId||void 0,interBuildingRole:"SOURCE",source:"treasury",transferId:l.id}),{merge:!0}),b=!0,a++;continue}if(!C&&H._bookId===f.bookId){o.set(pe(f.bookId,"transactions",H.id),$({buildingId:f.rawId,buildingBookId:f.bookId,type:"INCOME",incomeSubType:"OTHER",expenseCategory:"Inter-Building Transfer",expenseSubCategory:l.fromName||l.fromId||void 0,interBuildingRole:"DEST",source:"treasury",transferId:l.id}),{merge:!0}),C=!0,a++;continue}o.delete(pe(H._bookId,"transactions",H.id)),a++}const V=new Set([n,h.bookId,f.bookId]);l.originBookId&&V.add(l.originBookId);const O={date:l.date||new Date().toISOString().split("T")[0],amount:Number(l.amount)||0,paymentMethod:"TREASURY",originalPaymentMethod:l.paymentMethod||void 0,fromBankName:l.fromBankName||(l.paymentMethod==="BANK"||l.paymentMethod==="CHEQUE"?l.bankName:void 0)||void 0,toBankName:l.toBankName||void 0,bankName:l.fromBankName||l.bankName||void 0,fromType:l.fromType,toType:l.toType,fromId:l.fromId,toId:l.toId,fromName:l.fromName||void 0,toName:l.toName||void 0,purpose:l.purpose||l.notes||"Inter-Building Transfer",details:l.notes||l.purpose||"Inter-Building Transfer",status:l.status||"APPROVED",transferId:l.id,createdBy:l.createdBy,createdByName:l.createdByName,createdAt:l.createdAt||Date.now(),source:"treasury"};let L=_==null?void 0:_.id,z=w==null?void 0:w.id;if(!b){const H=l.transactionId?pe(h.bookId,"transactions",l.transactionId):pe(h.bookId,"transactions");L=H.id,o.set(H,$({...O,id:L,type:"EXPENSE",expenseCategory:"Inter-Building Transfer",expenseSubCategory:l.toName||l.toId||void 0,buildingId:h.rawId,buildingBookId:h.bookId,interBuildingRole:"SOURCE",interBuildingPeerTxId:z,interBuildingPeerBookId:f.bookId})),a++}if(!C){const H=l.transactionIdDest?pe(f.bookId,"transactions",l.transactionIdDest):pe(f.bookId,"transactions");z=H.id,o.set(H,$({...O,id:z,type:"INCOME",incomeSubType:"OTHER",expenseCategory:"Inter-Building Transfer",expenseSubCategory:l.fromName||l.fromId||void 0,buildingId:f.rawId,buildingBookId:f.bookId,interBuildingRole:"DEST",interBuildingPeerTxId:L,interBuildingPeerBookId:h.bookId})),a++}const ne={sourceBookId:h.bookId,destBookId:f.bookId,originBookId:l.originBookId||n};L&&(ne.transactionId=L),z&&(ne.transactionIdDest=z),V.forEach(H=>{o.set(pe(H,"transfers",l.id),ne,{merge:!0})})}return a>0&&await o.commit(),a}catch(n){return console.error("backfillInterBuildingTransactions error",n),0}},Td=async n=>{const e=Cn();let t=await Xe(pe(e,"transfers",n)).catch(()=>null),r=t&&t.exists()?{id:t.id,...t.data()}:null,s=[];if(!r){try{s=(await Y(te(q(),"books"))).docs.map(l=>l.id)}catch{}for(const u of s){if(u===e)continue;const l=await Xe(pe(u,"transfers",n)).catch(()=>null);if(l&&l.exists()){r={id:l.id,...l.data()};break}}}const i=new Set([e]);r&&(r.originBookId&&i.add(r.originBookId),r.sourceBookId&&i.add(r.sourceBookId),r.destBookId&&i.add(r.destBookId)),s.forEach(u=>i.add(u));const o=r&&r.transactionId?{id:r.transactionId,bookId:r.sourceBookId||r.originBookId||e}:null,a=r&&r.transactionIdDest?{id:r.transactionIdDest,bookId:r.destBookId||r.sourceBookId||e}:null;return{transfer:r,transferBooks:Array.from(i),sourceTx:o,destTx:a}},OD=async n=>{try{const{transfer:e,transferBooks:t,sourceTx:r,destTx:s}=await Td(n),i=pr(q());return t.forEach(o=>i.delete(pe(o,"transfers",n))),e&&(r&&i.delete(pe(r.bookId,"transactions",r.id)),s&&i.delete(pe(s.bookId,"transactions",s.id))),await i.commit(),!0}catch(e){return console.error("deleteTransfer error",e),me(M("transfers",n))}},xD=async(n,e)=>{try{const{transferBooks:t,sourceTx:r,destTx:s}=await Td(n),i={deleted:!0,deletedAt:Date.now(),deletedBy:e||"SYSTEM"},o=pr(q());t.forEach(a=>o.set(pe(a,"transfers",n),i,{merge:!0})),r&&o.set(pe(r.bookId,"transactions",r.id),i,{merge:!0}),s&&o.set(pe(s.bookId,"transactions",s.id),i,{merge:!0}),await o.commit()}catch(t){console.error("softDeleteTransfer error",t),await G(M("transfers",n),{deleted:!0,deletedAt:Date.now(),deletedBy:e||"SYSTEM"},{merge:!0})}},MD=async n=>{try{const{transferBooks:e,sourceTx:t,destTx:r}=await Td(n),s={deleted:!1,deletedAt:null,deletedBy:null},i=pr(q());e.forEach(o=>i.set(pe(o,"transfers",n),s,{merge:!0})),t&&i.set(pe(t.bookId,"transactions",t.id),s,{merge:!0}),r&&i.set(pe(r.bookId,"transactions",r.id),s,{merge:!0}),await i.commit()}catch(e){console.error("restoreTransfer error",e),await G(M("transfers",n),{deleted:!1,deletedAt:null,deletedBy:null},{merge:!0})}},LD=async n=>we("service_agreements",{includeDeleted:!!(n!=null&&n.includeDeleted)}),BD=async n=>{const e=$(n);return n.id?G(M("service_agreements",n.id),e):X(W("service_agreements"),e)},FD=async n=>me(M("service_agreements",n)),UD=async n=>{try{const e=new Date,t={id:`backup_${Date.now()}`,timestamp:e.toISOString(),date:e.toISOString().split("T")[0],size:new Blob([n]).size,data:n,createdAt:Date.now()};return vr("backups"),await G(M("backups",t.id),t),t}catch(e){throw console.error("Failed to save backup to Firestore:",e),e}},$D=async()=>{try{return(await Y(W("backups"))).docs.map(t=>t.data()).sort((t,r)=>new Date(r.timestamp).getTime()-new Date(t.timestamp).getTime())}catch(n){return console.error("Failed to get backups from Firestore:",n),[]}},qD=async n=>{try{vr("backups"),await me(M("backups",n))}catch(e){throw console.error("Failed to delete backup:",e),e}},jD=async n=>{try{vr("backups");const e=await Xe(M("backups",n));if(!e.exists())throw new Error("Backup not found");const t=e.data();return await fw(t.data)}catch(e){return console.error("Failed to restore backup:",e),!1}},Ci=async()=>{try{return(await Y(te(q(),"books"))).docs.map(e=>({id:e.id,...e.data()}))}catch(n){return String((n==null?void 0:n.code)||"")!=="permission-denied"&&console.error("getBooks error",n),[]}},GD=async n=>{const e=Cn(),t=!!(n!=null&&n.includeDeleted);let s=(await Ci()).map(o=>({id:o.id,name:o.name||o.id}));return s.some(o=>o.id==="default")||s.unshift({id:"default",name:"Main Book"}),(await Promise.all(s.map(async o=>{try{const a=ln(o.id,"transactions"),u=await Y(te(q(),a));return Be(u).filter(l=>t||!l.deleted).map(l=>{const h=l.buildingId,f=h&&o.id!==e?`${o.id}:${h}`:h;return{...l,_sourceBookId:o.id,_bookId:o.id,_bookName:o.name||o.id,buildingId:f}})}catch{return[]}}))).flat()},zD=async n=>{const e=Cn(),t=!!(n!=null&&n.includeDeleted);let s=(await Ci()).map(o=>({id:o.id,name:o.name||o.id}));return s.some(o=>o.id==="default")||s.unshift({id:"default",name:"Main Book"}),(await Promise.all(s.map(async o=>{try{const a=ln(o.id,"contracts"),u=await Y(te(q(),a));return Be(u).filter(l=>t||!l.deleted).map(l=>{const h=l.buildingId,f=h&&o.id!==e?`${o.id}:${h}`:h;return{...l,_sourceBookId:o.id,buildingId:f}})}catch{return[]}}))).flat()},KD=async n=>{const e=Cn(),t=!!(n!=null&&n.includeDeleted);let s=(await Ci()).map(o=>({id:o.id,name:o.name||o.id}));return s.some(o=>o.id==="default")||s.unshift({id:"default",name:"Main Book"}),(await Promise.all(s.map(async o=>{try{const a=ln(o.id,"transfers"),u=await Y(te(q(),a));return Be(u).filter(l=>t||!l.deleted).map(l=>{const h={...l,_sourceBookId:o.id,_bookId:o.id,_bookName:o.name||o.id};return h.fromType==="BUILDING"&&h.fromId&&o.id!==e&&(h.fromId=`${o.id}:${h.fromId}`),h.toType==="BUILDING"&&h.toId&&o.id!==e&&(h.toId=`${o.id}:${h.toId}`),h})}catch{return[]}}))).flat()},ww=async n=>{const e=Cn(),t=!!(n!=null&&n.includeDeleted);let s=(await Ci()).map(l=>({id:l.id,name:l.name||l.id}));s.some(l=>l.id==="default")||s.unshift({id:"default",name:"Main Book"});const i=new Set;s=s.filter(l=>i.has(l.id)?!1:(i.add(l.id),!0));const o=l=>{const h=(l||"").match(/(\d+)/g);return!h||h.length===0?null:parseInt(h[h.length-1],10)},u=(await Promise.all(s.map(async l=>{try{const h=ln(l.id,"buildings");return(await Y(te(q(),h))).docs.map(p=>{const _={id:p.id,...p.data()};if(!t&&_.deleted)return null;const w=p.id,b=l.id===e?w:`${l.id}:${w}`;return{..._,id:b,_sourceBookId:l.id,_rawBuildingId:w,_bookDisplayName:l.name}}).filter(Boolean)}catch{return[]}}))).flat();return u.sort((l,h)=>{const f=String(l._sourceBookId||"").localeCompare(String(h._sourceBookId||""));if(f!==0)return f;const p=(l==null?void 0:l.name)||"",_=(h==null?void 0:h.name)||"",w=o(p),b=o(_);return w!==null&&b!==null&&w!==b?w-b:w!==null&&b===null?-1:w===null&&b!==null?1:p.localeCompare(_,void 0,{sensitivity:"base"})}),u},WD=async n=>{const e=$({...n,updatedAt:Date.now()});return n.id?(await G(We(q(),"books",n.id),e,{merge:!0}),{id:n.id,...e}):{id:(await X(te(q(),"books"),e)).id,...e}},HD=async n=>{await me(We(q(),"books",n))},QD=async()=>we("sadad_bills","dueDate"),JD=async n=>{const e=$(n);return n.id?(await G(M("sadad_bills",n.id),e),n.id):(await X(W("sadad_bills"),e)).id},YD=async n=>me(M("sadad_bills",n)),XD=async()=>we("ejar_contracts","registrationDate"),ZD=async n=>{const e=$(n);return n.id?(await G(M("ejar_contracts",n.id),e),n.id):(await X(W("ejar_contracts"),e)).id},e0=async n=>me(M("ejar_contracts",n)),t0=async()=>we("utility_readings","readingDate"),n0=async n=>{const e=$(n);return n.id?(await G(M("utility_readings",n.id),e),n.id):(await X(W("utility_readings"),e)).id},r0=async n=>me(M("utility_readings",n)),s0=async()=>we("security_deposits","depositDate"),i0=async n=>{const e=$(n);return n.id?(await G(M("security_deposits",n.id),e),n.id):(await X(W("security_deposits"),e)).id},o0=async n=>me(M("security_deposits",n)),a0=async()=>we("whatsapp_messages","createdAt"),c0=async n=>{const e=$(n);return n.id?(await G(M("whatsapp_messages",n.id),e),n.id):(await X(W("whatsapp_messages"),e)).id},u0=async n=>me(M("whatsapp_messages",n)),l0=async()=>{try{const n=await Xe(M("meta","whatsapp_config"));return n.exists()?n.data():null}catch{return null}},h0=async n=>G(M("meta","whatsapp_config"),$(n)),d0=async()=>we("bank_statements","transactionDate"),f0=async n=>{const e=$(n);return n.id?(await G(M("bank_statements",n.id),e),n.id):(await X(W("bank_statements"),e)).id},m0=async n=>me(M("bank_statements",n)),p0=async()=>we("reconciliation_records","createdAt"),g0=async n=>{const e=$(n);return n.id?(await G(M("reconciliation_records",n.id),e),n.id):(await X(W("reconciliation_records"),e)).id},_0=async()=>we("nafath_verifications","createdAt"),y0=async n=>{const e=$(n);return n.id?(await G(M("nafath_verifications",n.id),e),n.id):(await X(W("nafath_verifications"),e)).id},I0=async n=>me(M("nafath_verifications",n)),w0=async()=>we("municipality_licenses","expiryDate"),E0=async n=>{const e=$(n);return n.id?(await G(M("municipality_licenses",n.id),e),n.id):(await X(W("municipality_licenses"),e)).id},T0=async n=>me(M("municipality_licenses",n)),A0=async()=>we("civil_defense_records","expiryDate"),v0=async n=>{const e=$(n);return n.id?(await G(M("civil_defense_records",n.id),e),n.id):(await X(W("civil_defense_records"),e)).id},b0=async n=>me(M("civil_defense_records",n)),S0=async()=>we("absher_records","createdAt"),R0=async n=>{const e=$(n);return n.id?(await G(M("absher_records",n.id),e),n.id):(await X(W("absher_records"),e)).id},P0=async n=>me(M("absher_records",n)),YV=Object.freeze(Object.defineProperty({__proto__:null,OWNER_PORTAL_ONLY_LOGIN:Ul,addStockEntry:AD,approveRequest:lD,backfillInterBuildingTransactions:VD,cascadeUnitRename:DN,changeUserPassword:GN,consumeStockItem:TD,createCreditNote:SN,dedupeApprovalsList:mw,deleteAbsherRecord:P0,deleteAmlakWorkbook:vN,deleteBackupFromFirestore:qD,deleteBank:Cc,deleteBankStatement:m0,deleteBook:HD,deleteBuilding:kN,deleteCivilDefenseRecord:b0,deleteContract:ZN,deleteCustomer:ON,deleteEjarContract:e0,deleteMunicipalityLicense:T0,deleteNafathVerification:I0,deleteSadadBill:YD,deleteSecurityDeposit:o0,deleteServiceAgreement:FD,deleteStockEntry:vD,deleteStockItem:ID,deleteTask:pN,deleteTransaction:cw,deleteTransfer:OD,deleteUser:UN,deleteUtilityReading:r0,deleteVendor:fN,deleteWhatsAppMessage:u0,generateBackup:sD,getAbsherRecords:S0,getActiveContract:tD,getAllReports:kD,getAllUsersGlobal:dD,getAmlakWorkbooks:iw,getApprovals:cD,getAuditLogs:rD,getBackupsFromFirestore:$D,getBankStatements:d0,getBankTransactionCounts:QN,getBanks:hw,getBooks:Ci,getBuildings:fu,getBuildingsAllBooks:ww,getCivilDefenseRecords:A0,getCollection:we,getContracts:pa,getContractsAllBooks:zD,getCurrentBookId:Cn,getCustomExpenseCategories:_N,getCustomIncomeCategories:IN,getCustomers:uw,getCustomersAcrossBooks:lw,getDataFromBook:CN,getEjarContracts:XD,getFirestoreStorageEstimate:HN,getIncomeExpenseByPeriod:_w,getIncomeExpenseSummary:gw,getMaintenanceReport:Iw,getMunicipalityLicenses:w0,getNafathVerifications:_0,getOccupancyStats:nD,getProfilePhoto:FN,getReconciliationRecords:p0,getSadadBills:QD,getSalaryReport:yw,getSecurityDeposits:s0,getServiceAgreements:LD,getSettings:sw,getStockEntries:_D,getStocks:gD,getTasks:rw,getTotalByType:PD,getTransactions:du,getTransactionsAllBooks:GD,getTransactionsFiltered:ki,getTransfers:CD,getTransfersAllBooks:KD,getTransfersFromBook:ND,getUserById:xN,getUserName:Pi,getUsers:Ed,getUsersAcrossBooks:MN,getUtilityReadings:t0,getVendors:nw,getWhatsAppConfig:l0,getWhatsAppMessages:a0,hashPassword:ps,isApprovalPendingForTarget:oD,isOwnerPortalAccount:Fl,isUnitOccupied:eD,listenAmlakWorkbooks:AN,listenApprovals:uD,listenTransactions:EN,loadUserByFirebaseUid:qN,loadUserByLoginId:$N,mergeBankAccounts:JN,mockLogin:jN,ownerStakeBuildingIdsMatch:cN,parseCompositeBuildingId:os,redeductStockFromTransaction:ED,requestContractDelete:pD,requestContractFinalize:fD,requestContractReverse:mD,requestPasswordReset:zN,requestTransactionDeletion:RN,requestTransactionEdit:aD,resetSystem:iD,restoreBackup:fw,restoreFromFirestoreBackup:jD,restoreStockFromTransaction:wD,restoreTransfer:MD,saveAbsherRecord:R0,saveAmlakWorkbook:ow,saveBackupToFirestore:UD,saveBank:KN,saveBankStatement:f0,saveBook:WD,saveBuilding:PN,saveCivilDefenseRecord:v0,saveContract:XN,saveCustomExpenseCategories:yN,saveCustomIncomeCategories:wN,saveCustomer:VN,saveEjarContract:ZD,saveMunicipalityLicense:E0,saveNafathVerification:y0,saveReconciliationRecord:g0,saveSadadBill:JD,saveSecurityDeposit:i0,saveServiceAgreement:BD,saveSettings:gN,saveStockItem:yD,saveTask:mN,saveTransaction:TN,saveTransactionInBook:aN,saveTransfer:DD,saveUser:LN,saveUserToken:hD,saveUtilityReading:n0,saveVendor:dN,saveWhatsAppConfig:h0,saveWhatsAppMessage:c0,sellStockItems:bD,setCurrentBook:oN,setUserScope:hN,softDeleteTransfer:xD,transferBuildingToBook:NN,updateBankAccount:YN,updateTransactionStatus:bN,uploadInvoicePdf:SD,uploadProfilePhoto:BN,verifyPassword:kc},Symbol.toStringTag,{value:"Module"}));export{zo as $,CD as A,MN as B,DD as C,OD as D,kt as E,Xt as F,ar as G,fi as H,Qo as I,SE as J,un as K,ge as L,Vc as M,nE as N,Up as O,tr as P,C0 as Q,N0 as R,pa as S,$s as T,CI as U,rC as V,oN as W,tD as X,qV as Y,Z0 as Z,Wr as _,gd as a,JV as a$,nC as a0,GV as a1,iw as a2,_N as a3,IN as a4,wC as a5,AN as a6,pC as a7,mC as a8,EN as a9,pr as aA,Ci as aB,O0 as aC,WD as aD,HD as aE,HC as aF,KV as aG,Fl as aH,Ul as aI,cD as aJ,iC as aK,wN as aL,LD as aM,KN as aN,BD as aO,VD as aP,XN as aQ,wD as aR,xD as aS,MD as aT,ED as aU,RN as aV,VN as aW,ON as aX,LN as aY,UN as aZ,QV as a_,ow as aa,yC as ab,jV as ac,ms as ad,_d as ae,fN as af,dN as ag,zV as ah,Q as ai,UI as aj,TC as ak,EC as al,rc as am,Ju as an,aC as ao,yN as ap,SN as aq,nD as ar,sw as as,Ae as at,Ne as au,lV as av,ha as aw,Xe as ax,DV as ay,X as az,ww as b,iI as b$,eD as b0,mN as b1,oC as b2,ZD as b3,ZN as b4,fD as b5,mD as b6,pD as b7,PN as b8,DN as b9,QD as bA,YD as bB,XD as bC,e0 as bD,n0 as bE,t0 as bF,r0 as bG,s0 as bH,i0 as bI,o0 as bJ,a0 as bK,l0 as bL,h0 as bM,d0 as bN,p0 as bO,g0 as bP,f0 as bQ,E0 as bR,w0 as bS,T0 as bT,v0 as bU,A0 as bV,b0 as bW,S0 as bX,R0 as bY,P0 as bZ,xN as b_,NN as ba,kN as bb,FD as bc,rw as bd,pN as be,sD as bf,fw as bg,xt as bh,rD as bi,gN as bj,GN as bk,BN as bl,QN as bm,YN as bn,HN as bo,JN as bp,Cc as bq,iD as br,gD as bs,_D as bt,yD as bu,ID as bv,TD as bw,AD as bx,c0 as by,JD as bz,GD as c,LV as c$,jo as c0,yP as c1,At as c2,j0 as c3,rn as c4,Ee as c5,bt as c6,bi as c7,kn as c8,be as c9,UV as cA,ae as cB,M0 as cC,aV as cD,oV as cE,F0 as cF,Rt as cG,Gv as cH,yV as cI,IV as cJ,uV as cK,tV as cL,eV as cM,_V as cN,K0 as cO,$0 as cP,lP as cQ,wP as cR,FV as cS,X0 as cT,Q0 as cU,BV as cV,Y0 as cW,vV as cX,G0 as cY,z0 as cZ,H0 as c_,D as ca,sn as cb,hP as cc,MP as cd,it as ce,Si as cf,ua as cg,tc as ch,lu as ci,la as cj,cu as ck,ad as cl,St as cm,uu as cn,Zn as co,_e as cp,xP as cq,Nt as cr,VP as cs,eh as ct,Fe as cu,Qr as cv,B as cw,L0 as cx,Ov as cy,Ve as cz,zD as d,pV as d0,mV as d1,xe as d2,da as d3,EP as d4,wV as d5,PV as d6,kV as d7,CV as d8,NV as d9,fV as dA,dV as dB,gV as dC,J0 as dD,iV as dE,W0 as dF,qN as dG,$N as dH,D0 as dI,V0 as dJ,$V as dK,YV as dL,Qh as da,MV as db,nV as dc,dP as dd,hV as de,ip as df,sV as dg,EV as dh,AV as di,TV as dj,rV as dk,fP as dl,VV as dm,OV as dn,cV as dp,SP as dq,CP as dr,kP as ds,Qy as dt,bV as du,q0 as dv,RV as dw,xV as dx,x0 as dy,SV as dz,KD as e,cw as f,Ed as g,aN as h,TN as i,Cn as j,du as k,fu as l,uw as m,nw as n,cN as o,WV as p,Y as q,te as r,hN as s,tC as t,HV as u,G as v,We as w,me as x,CN as y,hw as z};
