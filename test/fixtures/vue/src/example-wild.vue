<template>
<div class="hello">
  <h1>Example</h1>
</div>
</template>

<script lang="ts">
import Vue from "vue";
import Component from "vue-class-component";
import exampleCss from "./example.css";

@Component
export default class Example extends Vue {
  public msg: string = "Hello World"
  public x: string = "1";
  public y: string = exampleCss;
}
</script>

<style>
h1, h2 {
  font-weight: normal;
}
</style>
