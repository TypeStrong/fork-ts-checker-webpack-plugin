<script lang="ts">
// resolve by relative path
import Component1 from "./Component1.vue";            // imports/Component1.vue

// resolve by path from baseUrl(./src)
import Component2 from "imports/Component2.vue";      // imports/Component2.vue

// resolve by compilerOptions.paths
//  { "@/*": ["imports/*"] }
import Component3 from "@/Component3.vue";            // imports/Component3.vue

// resolve by compilerOptions.paths
// { "foo/*": ["imports/foo1/*", "imports/foo2/*"] }
import Foo1 from "foo/Foo1.vue";                      // imports/foo1/Foo1.vue
import Foo2 from "foo/Foo2.vue";                      // imports/foo2/Foo2.vue

export default {
  name: "ImportTest",
  components: {
    Component1,
    Component2,
    Component3,
    Foo1,
    Foo2
  }
};
</script>

