{ pkgs }: {
	deps = [
		pkgs.python36Full
  pkgs.python39Packages.bootstrapped-pip
  pkgs.nodejs-18_x
    pkgs.nodePackages.typescript-language-server
    pkgs.yarn
    pkgs.replitPackages.jest
	];
}