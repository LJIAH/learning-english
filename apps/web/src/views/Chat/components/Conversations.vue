<template>
  <div
    class="p-5 rounded-[5px] w-[256px] bg-purple-50 border border-right-1 border-t-0 border-b-0 border-l-0 border-gray-200"
  >
    <div
      @click="changeActive(value)"
      :class="{ 'bg-purple-300': active === value.id }"
      class="rounded-[5px] p-2 transition-all duration-300"
      v-for="value in chatMode"
      :key="value.id"
    >
      <div class="text-sm cursor-pointer p-2 px-4 text-gray-700">
        {{ value.label }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ChatMode, ChatModeList } from "@en/common/chat";
import { getChatModeList } from "@/apis/chat";
import { ref, onMounted } from "vue";
const emits = defineEmits(["onGetRole"]);
const chatMode = ref<ChatModeList | null>([]);
const active = ref<string | undefined>("");
const changeActive = (value: ChatMode) => {
  active.value = value.id;
  emits("onGetRole", value.role);
};
const init = async () => {
  const res = await getChatModeList();
  chatMode.value = res.data;
  active.value = res.data?.[0]?.id;
  emits("onGetRole", res.data?.[0]?.role);
};
onMounted(() => {
  init();
});
</script>
