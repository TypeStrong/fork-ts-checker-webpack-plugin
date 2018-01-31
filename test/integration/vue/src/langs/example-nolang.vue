<template>
<div>Example</div>
</template>

<script>
/* OK */
import Vue from "vue";
export default Vue.extend({
  name: "ExampleNolang",
  methods: {
    foo() {
      const a = 1; // noUnusedLocals
    }
  }
});
</script>

