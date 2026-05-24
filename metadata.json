import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import St from 'gi://St';

import { Extension } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

const McpNgrokIndicator = GObject.registerClass(
    { GTypeName: 'McpNgrokIndicator' },
    class McpNgrokIndicator extends PanelMenu.Button {
        constructor(extension) {
            super(0.0, 'Service Status Toggles', false);
            this._extension = extension;

            // 1. Core Panel Icon Configuration
            this._icon = new St.Icon({
                icon_name: 'network-server-symbolic',
                style_class: 'system-status-icon'
            });
            this.add_child(this._icon);

            // 2. Centralized Service Configurations (Ordered for UI layout)
            this._services = {
                mcp: {
                    name: 'MCP Jungle',
                    cmd: 'export PATH="$HOME/.local/bin:/home/linuxbrew/.linuxbrew/bin:$PATH"; exec /home/linuxbrew/.linuxbrew/bin/mcpjungle start --sqlite-db-path ~/.mcpjungle.db',
                    process: null,
                    active: false,
                    item: null // Remains null as it has no UI toggle
                },
                opencode: {
                    name: 'OpenCode',
                    cmd: 'export PATH="$HOME/.local/bin:/home/linuxbrew/.linuxbrew/bin:$PATH"; exec /home/linuxbrew/.linuxbrew/bin/opencode serve --hostname 127.0.0.1 --port 4096',
                    process: null,
                    active: false,
                    item: null
                },
                ngrok: {
                    name: 'ngrok',
                    cmd: 'exec ~/.local/bin/ngrok http 8080 --config ~/.config/ngrok/ngrok.yml',
                    process: null,
                    active: false,
                    item: null
                }
            };

            // 3. Dynamic Dropdown Menu Assembly
            this._buildMenu();
        }

        _buildMenu() {
            for (let key in this._services) {
                // Skip creating a menu item for MCP Jungle (handled in background)
                if (key === 'mcp') continue;

                let service = this._services[key];

                // Create individual toggle switches for visible services
                let menuItem = new PopupMenu.PopupSwitchMenuItem(service.name, service.active);
                service.item = menuItem;

                // Intercept the click sequence to prevent menu closure
                menuItem.activate = function (event) {
                    this.toggle();
                };

                // Listen to interactive toggles
                menuItem.connect('toggled', (item, state) => {
                    this._handleToggle(key, state);
                });

                this.menu.addMenuItem(menuItem);
            }
        }

        _handleToggle(key, state) {
            let service = this._services[key];
            
            // Guard against loops if state updates happen programmatically
            if (service.active === state) return;

            if (state) {
                this._startService(key);
            } else {
                this._stopService(key);
            }

            // Evaluate dependent lifecycle for MCP Jungle (Option A)
            this._updateMcpLifecycle();
        }

        _updateMcpLifecycle() {
            let ngrokActive = this._services.ngrok.active;
            let opencodeActive = this._services.opencode.active;
            let mcp = this._services.mcp;

            // Option A: Start if EITHER is active, stop only if BOTH are inactive
            if ((ngrokActive || opencodeActive) && !mcp.active) {
                this._startService('mcp');
            } else if (!ngrokActive && !opencodeActive && mcp.active) {
                this._stopService('mcp');
            }
        }

        _startService(key) {
            let service = this._services[key];

            try {
                // Ensure the pipeline is clear before launching
                this._killProcess(service);

                service.process = Gio.Subprocess.new(
                    ['/bin/bash', '-c', service.cmd],
                    Gio.SubprocessFlags.NONE
                );
                
                service.active = true;
                this._watchProcess(key, service.process);
                
                // Visual feedback: Switch UI state if the item exists
                if (service.item) service.item.setToggleState(true);
                
            } catch (e) {
                console.error(`[Service-Toggle] Error starting ${service.name}: ${e.message}`);
                this._stopService(key);
            }

            this._updatePanelIconState();
        }

        _stopService(key) {
            let service = this._services[key];
            service.active = false;

            this._killProcess(service);

            // Visual feedback: Reset toggle state UI if the item exists
            if (service.item) service.item.setToggleState(false);
            
            this._updatePanelIconState();
        }

        _watchProcess(key, proc) {
            proc.wait_async(null, (p, res) => {
                try { p.wait_finish(res); } catch (e) {}
                
                let service = this._services[key];
                // If the process died unexpectedly while still flag-active, handle lifecycle cleanup
                if (service && service.process === p && service.active) {
                    this._stopService(key);
                    
                    // If MCP itself crashes unexpectedly, this ensures its state resets properly
                    if (key !== 'mcp') {
                        this._updateMcpLifecycle();
                    }
                }
            });
        }

        _killProcess(service) {
            if (service.process) {
                try { service.process.force_exit(); } catch (e) {}
                service.process = null;
            }
        }

        _updatePanelIconState() {
            // Check if at least one service is actively running
            let anyActive = Object.values(this._services).some(s => s.active);
            if (anyActive) {
                this._icon.set_style('color: #2ec27e;'); // Standard GNOME green accent
            } else {
                this._icon.set_style(''); // Clear style back to standard theme neutral color
            }
        }

        destroy() {
            // Clean up all running background jobs when extension disables/stops
            for (let key in this._services) {
                this._stopService(key);
            }
            super.destroy();
        }
    }
);

export default class McpNgrokToggleExtension extends Extension {
    enable() {
        this._indicator = new McpNgrokIndicator(this);
        Main.panel.addToStatusArea(this.uuid, this._indicator);
    }

    disable() {
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
    }
}
