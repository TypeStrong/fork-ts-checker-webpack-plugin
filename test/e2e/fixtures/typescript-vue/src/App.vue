<template>
    <logged-in v-if="user" :user="user" @logout="logout"></logged-in>
    <login-form v-else @login="login"></login-form>
</template>

<script lang="ts">
  import LoginForm from "@/component/LoginForm.vue";
  import LoggedIn from "@/component/LoggedIn.vue";
  import User from "@/model/User";

  export default {
    data() {
      return {
        user: null
      }
    },
    components: {
      LoginForm,
      LoggedIn
    },
    login(user: User) {
      this.user = user;
    },
    logout() {
      this.user = null;
    }
  }
</script>
