import { spawnSync } from "node:child_process";

const BASELINE_ERRORS = Number(process.env.TSC_BASELINE_ERRORS ?? "0");

const run = spawnSync("npm", ["run", "typecheck", "--silent"], {
  encoding: "utf8",
  shell: true,
});

const output = `${run.stdout ?? ""}\n${run.stderr ?? ""}`;
const tsErrorMatches = output.match(/error TS\d+:/g) ?? [];
const errorCount = tsErrorMatches.length;

if (run.status === 0) {
  console.log("typecheck-gate: sem erros de TypeScript.");
  process.exit(0);
}

if (errorCount <= BASELINE_ERRORS) {
  console.log(
    `typecheck-gate: ${errorCount} erro(s) TS dentro do baseline (${BASELINE_ERRORS}).`
  );
  process.exit(0);
}

console.error(
  `typecheck-gate: ${errorCount} erro(s) TS excedem o baseline (${BASELINE_ERRORS}).`
);
console.error(
  "Ajuste o código para não introduzir novos erros ou reduza a dívida antes de endurecer o gate."
);
process.exit(1);

