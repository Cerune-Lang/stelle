# Stelle

A small **interactive CLI RPG** written in Cerune. The game's rules live in Cerune, without a duplicate Rust implementation.

## Run

Build or install the latest [Cerune](https://github.com/Cerune-Lang/Cerune).

```sh
cerune check src/main.ceru
cerune run src/main.ceru
```

Choose `1` to attack, `2` to heal, or `3` to escape. Incorrect input does not consume a combat turn. The battle ends on victory, defeat, escape or EOF. The prompt is explicitly flushed before input.

**Connection limitations:** Cerune's `std:io::read_line` supports Linux terminals and Windows/Linux files and pipes. **Direct Windows PowerShell/console input is currently unsupported** by the Cerune stdin contract; use WSL/Linux or pipe input from a file. For example, from PowerShell:

```powershell
"1`n1`n1" | Set-Content -Encoding utf8 commands.txt
cmd /c "cerune run src/main.ceru < commands.txt"
```

For the original noninteractive demo:

```sh
cerune run src/demo.ceru
```

## Structure

| File | Responsibility |
| --- | --- |
| `src/battle.ceru` | RPG rules and pure `advance(state, action) -> Turn`, plus legacy presentation wrapper |
| `src/main.ceru` | Interactive stdin command loop |
| `src/demo.ceru` | Original scripted battle |
| `src/engine_checks.ceru` | State-transition checks |
| `scripts/check_engine.py` | Differential tests of battle transitions |
| `scripts/check_interactive.py` | Eight scripted input scenarios over four execution routes |

The engine remains a small game-specific foundation rather than a general-purpose framework. UI/input can change without rewriting damage, potion or enemy-turn rules.

## Checks

```sh
python3 scripts/check_engine.py --binary cerune
python3 scripts/check_interactive.py --binary cerune
```

The interactive checks feed exact bytes through pipes (not Windows console input), covering victory, escape, invalid actions, healing, potion depletion, defeat, CRLF, final lines without newline and EOF. CI builds Cerune before running the checks.
