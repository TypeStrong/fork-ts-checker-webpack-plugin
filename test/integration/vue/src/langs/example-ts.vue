<template>
<div>{{ text }}</div>
</template>

<script lang="ts">
/* OK */
import Vue from "vue";
export default Vue.extend({
  name: "ExampleJs",
  computed: {
    text(): string {
      const a = 1; // noUnusedLocals
      return "Example";
    }
  }
});
</script>

