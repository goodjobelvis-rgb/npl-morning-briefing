import "server-only";
import { cacheLife } from "next/cache";
import { buildBriefing } from "./index";

// 페이지를 열 때마다 AI를 부르지 않도록 결과를 1시간 정도 보관한다.
// (실패하면 보관되지 않으므로 다음에 열 때 다시 시도한다.)
export async function getTodaysBriefing() {
  "use cache";
  cacheLife("hours");
  return buildBriefing();
}
