# Luau Type Gen

A minimal VS Code extension for Roblox/Luau developers. It automatically generates and updates `export type` definitions for your classes.

## Usage

Open a `.luau` file with a class structure and press **`Ctrl + K`**, then **`L`**.

The extension parses your `self` properties and `Class:Method` definitions, injecting the explicit types at the top of the file. Pressing the keybind again will safely update the existing block.

### Example

**Before:**
```luau
local Player = {}
Player.__index = Player

function Player.new()
    local self = setmetatable({}, Player)
    self.Name: string = "Guest"
    self.Health: number = 100
    return self
end

function Player:TakeDamage(amount: number)
    self.Health -= amount
end

return Player