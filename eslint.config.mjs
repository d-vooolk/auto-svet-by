import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "src/generated/**",
  ]),
  {
    rules: {
      /**
       * next/image требует сервер-оптимизатор, которого при статическом
       * экспорте нет. Вместо него все размеры и форматы генерируются на
       * сборке (scripts/images.mjs), а компонент Picture выдаёт <picture> с
       * avif/webp, srcset, sizes, width/height и lazy-загрузкой — то есть
       * ровно то, ради чего правило и существует.
       */
      "@next/next/no-img-element": "off",
    },
  },
]);

export default eslintConfig;
