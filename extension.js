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

        _init(extension) {
            super._init(0.0, 'Service Status Toggles', false);
            this._extension = extension;
            this._cancellable = new Gio.Cancellable();

            this._icon = new St.Icon({
                icon_name: 'network-server-symbolic',
                style_class: 'system-status-icon',
            });
            this.add_child(this._icon);

            this._services = {
                mcp: {
                    name: 'MCP Jungle',
                    cmd: 'export PATH="$HOME/.local/bin:/home/linuxbrew/.linuxbrew/bin:$PATH"; exec /home/linuxbrew/.linuxbrew/bin/mcpjungle start --sqlite-db-path ~/.mcpjungle.db',
                    process: null, active: false, item: null,
                },
                opencode: {
                    name: 'OpenCode',
                    cmd: 'export PATH="$HOME/.local/bin:/home/linuxbrew/.linuxbrew/bin:$PATH"; exec /home/linuxbrew/.linuxbrew/bin/opencode serve --hostname 127.0.0.1 --port 4096',
                    process: null, active: false, item: null,
                },
                ngrok: {
                    name: 'ngrok',
                    cmd: 'exec ~/.local/bin/ngrok http 8080 --config ~/.config/ngrok/ngrok.yml',
                    process: null, active: false, item: null,
                },
            };

            this._buildMenu();
        }

        _buildMenu() {
            for (let key in this._services) {
                if (key === 'mcp') continue;

                let service = this._services[key];
                let item = new PopupMenu.PopupSwitchMenuItem(service.name, false);
                service.item = item;

                item.connectObject(
                    'toggled', (_i, state) => this._handleToggle(key, state),
                    this
                );

                this.menu.addMenuItem(item);
            }
        }

        _handleToggle(key, state) {
            let service = this._services[key];
            if (service.active === state) return;
            state ? this._startService(key) : this._stopService(key);
            this._updateMcpLifecycle();
        }

        _updateMcpLifecycle() {
            let { ngrok, opencode, mcp } = this._services;
            let anyActive = ngrok.active || opencode.active;
            if (anyActive && !mcp.active) this._startService('mcp');
            else if (!anyActive && mcp.active) this._stopService('mcp');
        }

        _startService(key) {
            let service = this._services[key];
            this._killProcess(service);
            try {
                service.process = Gio.Subprocess.new(
                    ['/bin/bash', '-c', service.cmd],
                    Gio.SubprocessFlags.STDOUT_SILENCE | Gio.SubprocessFlags.STDERR_SILENCE
                );
                service.active = true;
                this._watchProcess(key, service.process);
                service.item?.setToggleState(true);
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
            service.item?.setToggleState(false);
            this._updatePanelIconState();
        }

        _watchProcess(key, proc) {
            proc.wait_async(this._cancellable, (p, res) => {
                try { p.wait_finish(res); } catch (_e) { return; }
                let service = this._services[key];
                if (service?.process === p && service.active) {
                    this._stopService(key);
                    if (key !== 'mcp') this._updateMcpLifecycle();
                }
            });
        }

        _killProcess(service) {
            if (service.process) {
                try { service.process.force_exit(); } catch (_e) {}
                service.process = null;
            }
        }

        _updatePanelIconState() {
            if (!this._icon) return;
            let anyActive = Object.values(this._services).some(s => s.active);
            this._icon.set_style(anyActive ? 'color: #2ec27e;' : '');
        }

        destroy() {
            this._cancellable.cancel();
            for (let key in this._services) this._stopService(key);
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
        this._indicator?.destroy();
        this._indicator = null;
    }
}
