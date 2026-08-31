import { createRouter, createWebHashHistory } from 'vue-router';
import HomeView from '../views/HomeView.vue';

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    { path: '/search', name: 'search', component: () => import('../views/SearchView.vue') },
    { path: '/fund/:code', name: 'fund-detail', component: () => import('../views/DetailView.vue') }
  ]
});

export default router;
