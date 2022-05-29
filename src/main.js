import Vue from 'vue'
import App from './App.vue'
import vuetify from '@/plugins/vuetify' 
import router from './router'
import AudioRecorder from 'vue-audio-recorder'
import axios from 'axios'

Vue.prototype.$http = axios
Vue.use(AudioRecorder)

new Vue({
  vuetify,
  router,
  render: h => h(App)
}).$mount('#app')
