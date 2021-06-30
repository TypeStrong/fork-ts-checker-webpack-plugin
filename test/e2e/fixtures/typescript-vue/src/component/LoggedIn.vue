<template>
    <p>
        Hello {userName}!
        <button type="button" v-bind:disabled="pending" v-on:click="logout">Logout</button>
    </p>
</template>

<script lang="ts">
  import User, { getUserName } from '@/model/User';

  export default {
    props: {
      user: {
        type: Object,
        required: true
      }
    },
    data() {
      return {
        pending: false
      }
    },
    computed: {
      userName: () => {
        const user: User = this.user;

        return user ? getUserName(user) : '';
      }
    },
    async logout() {
      try {
        this.pending = true;
        await fetch('/logout');
      } catch (error) {
        console.error(error);
      } finally {
        this.pending = false;
      }
    }
  }
</script>

<style scoped>
    p {
        font-size: 14pt;
    }
</style>
