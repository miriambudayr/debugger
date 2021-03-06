/* Any copyright is dedicated to the Public Domain.
 * http://creativecommons.org/publicdomain/zero/1.0/ */

// Tests loading sourcemapped sources, setting breakpoints, and
// stepping in them.
requestLongerTimeout(2);

function assertBreakpointExists(dbg, source, line) {
  const {
    selectors: { getBreakpoint },
    getState
  } = dbg;

  ok(
    getBreakpoint(getState(), { sourceId: source.id, line }),
    "Breakpoint has correct line"
  );
}

async function assertEditorBreakpoint(dbg, line, shouldExist) {
  const el = await getLineEl(dbg, line);
  const exists = !!el.querySelector(".new-breakpoint");
  ok(
    exists === shouldExist,
    "Breakpoint " +
      (shouldExist ? "exists" : "does not exist") +
      " on line " +
      line
  );
}

async function getLineEl(dbg, line) {
  let el = await codeMirrorGutterElement(dbg, line);
  while (el && !el.matches(".CodeMirror-code > div")) {
    el = el.parentElement;
  }
  return el;
}

async function clickGutter(dbg, line) {
  const el = await codeMirrorGutterElement(dbg, line);
  clickDOMElement(dbg, el);
}

add_task(async function() {
  // NOTE: the CORS call makes the test run times inconsistent
  const dbg = await initDebugger("doc-sourcemaps.html", "entry.js", "output.js", "times2.js", "opts.js");
  const {
    selectors: { getBreakpoint, getBreakpointCount },
    getState
  } = dbg;

  ok(true, "Original sources exist");
  const bundleSrc = findSource(dbg, "bundle.js");

  // Check that the original sources appear in the source tree
  await clickElement(dbg, "sourceDirectoryLabel", 3);
  await assertSourceCount(dbg, 8);

  await selectSource(dbg, bundleSrc);

  await clickGutter(dbg, 70);
  await waitForDispatch(dbg, "ADD_BREAKPOINT");
  assertEditorBreakpoint(dbg, 70, true);

  await clickGutter(dbg, 70);
  await waitForDispatch(dbg, "REMOVE_BREAKPOINT");
  is(getBreakpointCount(getState()), 0, "No breakpoints exists");

  const entrySrc = findSource(dbg, "entry.js");

  await selectSource(dbg, entrySrc);
  ok(
    getCM(dbg)
      .getValue()
      .includes("window.keepMeAlive"),
    "Original source text loaded correctly"
  );

  // Test breaking on a breakpoint
  await addBreakpoint(dbg, "entry.js", 15);
  is(getBreakpointCount(getState()), 1, "One breakpoint exists");
  assertBreakpointExists(dbg, entrySrc, 15);

  invokeInTab("keepMeAlive");
  await waitForPaused(dbg);
  assertPausedLocation(dbg);

  await stepIn(dbg);
  assertPausedLocation(dbg);

  await dbg.actions.jumpToMappedSelectedLocation();
  await stepOver(dbg);
  assertPausedLocation(dbg);
  assertDebugLine(dbg, 71);

  await dbg.actions.jumpToMappedSelectedLocation();
  await stepOut(dbg);
  assertPausedLocation(dbg);
  assertDebugLine(dbg, 16);
});
