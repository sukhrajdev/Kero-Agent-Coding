import { exec } from "child_process";

function execute_command(command) {
    return new Promise((resolve, reject) => {
        exec(command, (err, stdout, stderr) => {
            if (err) {
                reject({
                    type: "EXEC_ERROR",
                    message: err.message,
                    code: err.code
                });
                return;
            }

            if (stderr) {
                reject({
                    type: "STDERR",
                    message: stderr
                });
                return;
            }

            resolve(stdout.trim());
        });
    });
}
