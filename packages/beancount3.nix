{ pkgs ? import <nixpkgs> {} }:

pkgs.python3Packages.buildPythonPackage rec {
  pname = "beancount";
  version = "3.1.0";
  format = "pyproject";

  src = pkgs.fetchFromGitHub {
    owner = "beancount";
    repo = pname;
    rev = "f6dd8dfede9f2c4fec3ca312d4c499b25aa402a0";
    sha256 = "sha256-ogjBW/NGlMmhYlzcx3EWWoVi+OOEv2Wm49tzwMiNb8A=";
  };


  nativeBuildInputs = with pkgs; [
    python3Packages.meson-python
    ninja
    gnupg
    bison
    flex
    pkg-config
  ];

  propagatedBuildInputs = with pkgs.python3Packages; [
    pip

    # from https://github.com/beancount/beancount/blob/558d0b1ce02af238ca81342aa635b386e74be23c/requirements/tools.txt#L7
    click
    google-api-python-client
    google-auth-oauthlib
    httplib2
    lxml
    oauth2client
    ply
    python-dateutil
    regex
    requests
  ];

  meta = with pkgs.lib; {
    description = "A double-entry bookkeeping computer language";
    homepage = "https://beancount.github.io/";
    license = licenses.gpl2Only;
  };
}

