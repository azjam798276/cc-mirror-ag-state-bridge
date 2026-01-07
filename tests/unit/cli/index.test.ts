import { Command } from 'commander';
import * as listCmd from '../../../src/cli/list-ag-sessions';
import * as showCmd from '../../../src/cli/show-ag-session';
import * as sendCmd from '../../../src/cli/send';

jest.mock('commander');
jest.mock('../../../src/cli/list-ag-sessions');
jest.mock('../../../src/cli/show-ag-session');
jest.mock('../../../src/cli/send');

describe('CLI Entry Point', () => {
    let mockProgram: any;

    beforeEach(() => {
        jest.clearAllMocks();
        mockProgram = {
            name: jest.fn().mockReturnThis(),
            description: jest.fn().mockReturnThis(),
            version: jest.fn().mockReturnThis(),
            parse: jest.fn(),
            outputHelp: jest.fn(),
        };
        (Command as unknown as jest.Mock).mockImplementation(() => mockProgram);
    });

    it('should register all commands and parse argv', () => {
        // Isolate modules to trigger the top-level execution in index.ts
        jest.isolateModules(() => {
            require('../../../src/cli/index');
        });

        expect(listCmd.registerListAgSessionsCommand).toHaveBeenCalled();
        expect(showCmd.registerShowAgSessionCommand).toHaveBeenCalled();
        expect(sendCmd.registerSendCommand).toHaveBeenCalled();

        expect(mockProgram.name).toHaveBeenCalledWith('cc-mirror');
        expect(mockProgram.parse).toHaveBeenCalled();
    });

    it('should output help if no args provided', () => {
        const originalArgv = process.argv;
        process.argv = ['node', 'cc-mirror']; // No args

        jest.isolateModules(() => {
            require('../../../src/cli/index');
        });

        expect(mockProgram.outputHelp).toHaveBeenCalled();

        process.argv = originalArgv;
    });
});
