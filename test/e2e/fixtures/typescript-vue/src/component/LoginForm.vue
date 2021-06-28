<template>
    <form @submit="login">
        <h1>Login form</h1>

        <input v-model="email" name="email" type="email" />
        <input v-model="password" name="password" type="password" />

        <qrcode-vue :value="url"></qrcode-vue>

        <button type="submit" v-bind:disabled="pending">Login</button>
    </form>
</template>

<script lang="ts">
  import QrcodeVue from "qrcode.vue";

  export default {
    data() {
      return {
        email: '',
        password: '',
        pending: false
      }
    },
    components: {
      QrcodeVue
    },
    async login() {
      try {
        this.pending = true;
        const response = await fetch(
          '/login',
          {
            method: 'POST',
            body: JSON.stringify({
              email: this.email,
              password: this.password
            })
          }
        );
      } catch (error) {
        console.error(error);
      } finally {
        this.pending = false;
      }
    }
  }
</script>

<style scoped>
    h1 {
        font-weight: normal;
    }
</style>
