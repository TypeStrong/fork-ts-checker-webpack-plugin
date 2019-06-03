<script lang="tsx">
/* OK */
import Vue, { VNode } from "vue";
export default Vue.extend({
  name: "ExampleTsx",
  render(): VNode {
    const a = 1; // noUnusedLocals
    return <div>Example</div>;
  }
});
</script>
