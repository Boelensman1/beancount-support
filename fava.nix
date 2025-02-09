{ pkgs ? import <nixpkgs> {} }:

let
  fava = pkgs.callPackage ./packages/fava.nix {};
in pkgs.mkShell {
  buildInputs = with pkgs; [
    fava
  ];
}
