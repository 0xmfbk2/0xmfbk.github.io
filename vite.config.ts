import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  // 1. بما أن GitHub Pages تستضيف ملفات ثابتة، نحتاج لتغيير الـ base
  // استبدل 'repo-name' باسم المستودع الخاص بك على GitHub
  base: "/0xmfbk.github.io/", 

  // 2. إزالة إعدادات الـ nitro لأنها خاصة بالسيرفرات وليست للمواقع الثابتة
  // (GitHub Pages لا تحتاج nitro)
  
  tanstackStart: {
    // 3. تأكد أن المشروع لا يعتمد على SSR في هذا الوضع
    server: { entry: "client" }, 
  },
});