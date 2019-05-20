<template>
<div>Example</div>
</template>

<script lang="js">
/* OK */
import Vue from "vue";
export default Vue.extend({
  name: "ExampleJs",
  methods: {
    foo() {
      const a = 1; // noUnusedLocals
    }
  }
});
</script>

